import { Application } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { linhaHex, mundoParaHex, type CoordHex, type PontoMundo } from '../core/hex';
import type { LojaMapa } from '../core/loja';
import type { Manifesto } from '../core/manifesto';
import { carregarCatalogo, type Catalogo } from './assets';
import { criarCamadaDecoracoes, type DecoracaoEncontrada } from './camadaDecoracoes';
import { criarCamadaGrid, criarDestaqueHex } from './camadaGrid';
import { criarCamadaTiles } from './camadaTiles';

const ZOOM_MINIMO = 0.15;
const ZOOM_MAXIMO = 2;
const ZOOM_INICIAL = 0.6;
const BOTAO_ESQUERDO = 0;

export interface OpcoesCena {
  readonly loja: LojaMapa;
  readonly manifesto: Manifesto;
  /** Chamada quando o hex sob o mouse muda; recebe `null` quando o mouse sai do mapa. */
  readonly aoMudarHexSobMouse: (coord: CoordHex | null) => void;
  /** Chamada quando o ponto do mundo sob o mouse muda. */
  readonly aoMoverPonteiro: (ponto: PontoMundo | null) => void;
  /** O botão esquerdo foi apertado neste ponto. */
  readonly aoIniciarTraco: (ponto: PontoMundo) => void;
  /** Com o botão apertado, o mouse chegou a este hex. */
  readonly aoContinuarTraco: (coord: CoordHex) => void;
  /** Com o botão apertado, o mouse se moveu para este ponto. */
  readonly aoMoverDuranteTraco: (ponto: PontoMundo) => void;
  readonly aoTerminarTraco: () => void;
}

interface ControlesCena {
  mundoEm(x: number, y: number): PontoMundo;
  mostrarPrevia(assetId: string, coord: CoordHex): void;
  mostrarPreviaDecoracao(assetId: string, posicao: PontoMundo): void;
  limparPrevia(): void;
  decoracaoEm(ponto: PontoMundo): DecoracaoEncontrada | null;
  moverDecoracaoVisual(decoracaoId: string, posicao: PontoMundo): void;
  sincronizarDecoracoes(): void;
  cancelarAssinatura(): void;
}

export interface CenaMapa extends Omit<ControlesCena, 'mundoEm' | 'cancelarAssinatura'> {
  /** Ponto do mundo em uma posição da tela, ou `null` enquanto a cena está carregando. */
  mundoEm(x: number, y: number): PontoMundo | null;
  destruir(): void;
}

/**
 * Cria a cena do mapa dentro de `container`.
 * A inicialização é assíncrona, então a cena pode ser destruída antes de ficar pronta.
 */
export function createMapScene(container: HTMLElement, opcoes: OpcoesCena): CenaMapa {
  const app = new Application();
  let ready = false;
  let disposed = false;
  let controles: ControlesCena | null = null;

  const iniciar = async () => {
    await app.init({
      resizeTo: container,
      background: '#14161c',
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    if (disposed) {
      app.destroy(true);
      return;
    }
    ready = true;
    container.appendChild(app.canvas);

    const catalogo = await carregarCatalogo(opcoes.manifesto);
    if (!disposed) {
      controles = montarCena(app, catalogo, opcoes);
    }
  };
  void iniciar();

  return {
    mundoEm: (x, y) => controles?.mundoEm(x, y) ?? null,
    mostrarPrevia: (assetId, coord) => controles?.mostrarPrevia(assetId, coord),
    mostrarPreviaDecoracao: (assetId, posicao) =>
      controles?.mostrarPreviaDecoracao(assetId, posicao),
    limparPrevia: () => controles?.limparPrevia(),
    decoracaoEm: (ponto) => controles?.decoracaoEm(ponto) ?? null,
    moverDecoracaoVisual: (decoracaoId, posicao) =>
      controles?.moverDecoracaoVisual(decoracaoId, posicao),
    sincronizarDecoracoes: () => controles?.sincronizarDecoracoes(),
    destruir() {
      disposed = true;
      controles?.cancelarAssinatura();
      controles = null;
      if (ready) {
        app.destroy(true, { children: true });
      }
    },
  };
}

function montarCena(app: Application, catalogo: Catalogo, opcoes: OpcoesCena): ControlesCena {
  const camera = new Viewport({
    screenWidth: app.screen.width,
    screenHeight: app.screen.height,
    events: app.renderer.events,
    disableOnContextMenu: true,
  });
  // O botão esquerdo fica livre para editar o mapa.
  camera
    .drag({ mouseButtons: 'middle-right' })
    .pinch()
    .wheel()
    .clampZoom({ minScale: ZOOM_MINIMO, maxScale: ZOOM_MAXIMO });
  camera.setZoom(ZOOM_INICIAL, true);
  camera.moveCenter(0, 0);
  app.stage.addChild(camera);
  app.renderer.on('resize', (largura: number, altura: number) => camera.resize(largura, altura));

  const grid = criarCamadaGrid();
  const tiles = criarCamadaTiles(catalogo);
  const decoracoes = criarCamadaDecoracoes(catalogo, tiles.container);
  const destaque = criarDestaqueHex();
  camera.addChild(grid.grafico, tiles.container, decoracoes.container, destaque.grafico);

  const atualizarCamadas = () => {
    const estado = opcoes.loja.obterEstado();
    tiles.atualizar(estado);
    decoracoes.atualizar(estado);
  };
  atualizarCamadas();
  const cancelarAssinatura = opcoes.loja.assinar(atualizarCamadas);

  const mundoDoEvento = (evento: PointerEvent): PontoMundo => {
    const { x, y } = camera.toWorld(evento.offsetX, evento.offsetY);
    return { x, y };
  };

  const dentroDaTela = (evento: PointerEvent) =>
    evento.offsetX >= 0 &&
    evento.offsetY >= 0 &&
    evento.offsetX < app.screen.width &&
    evento.offsetY < app.screen.height;

  let ultimoHexDoTraco: CoordHex | null = null;

  app.canvas.addEventListener('pointerdown', (evento) => {
    if (evento.button !== BOTAO_ESQUERDO) {
      return;
    }
    // Mantém o traço mesmo se o mouse sair do mapa enquanto o botão está apertado.
    app.canvas.setPointerCapture(evento.pointerId);
    const ponto = mundoDoEvento(evento);
    ultimoHexDoTraco = mundoParaHex(ponto);
    opcoes.aoIniciarTraco(ponto);
  });

  const continuarTraco = (evento: PointerEvent) => {
    if (!ultimoHexDoTraco || !dentroDaTela(evento)) {
      return;
    }
    const ponto = mundoDoEvento(evento);
    // Um movimento rápido pode saltar vários hexes entre dois eventos do mouse.
    const [, ...novos] = linhaHex(ultimoHexDoTraco, mundoParaHex(ponto));
    novos.forEach(opcoes.aoContinuarTraco);
    ultimoHexDoTraco = novos[novos.length - 1] ?? ultimoHexDoTraco;
    opcoes.aoMoverDuranteTraco(ponto);
  };

  const terminarTraco = () => {
    if (ultimoHexDoTraco) {
      ultimoHexDoTraco = null;
      opcoes.aoTerminarTraco();
    }
  };
  app.canvas.addEventListener('pointerup', terminarTraco);
  app.canvas.addEventListener('pointercancel', terminarTraco);

  let ponteiro: { x: number; y: number } | null = null;
  app.canvas.addEventListener('pointermove', (evento) => {
    ponteiro = dentroDaTela(evento) ? { x: evento.offsetX, y: evento.offsetY } : null;
    continuarTraco(evento);
  });
  app.canvas.addEventListener('pointerleave', () => {
    ponteiro = null;
  });

  let hexAtual: CoordHex | null = null;
  let pontoAtual: PontoMundo | null = null;
  // Roda a cada quadro para acompanhar também o zoom e o arrasto, com o mouse parado.
  app.ticker.add(() => {
    grid.atualizar({
      minX: camera.left,
      minY: camera.top,
      maxX: camera.right,
      maxY: camera.bottom,
    });

    const mundo = ponteiro ? camera.toWorld(ponteiro.x, ponteiro.y) : null;
    if (mundo?.x !== pontoAtual?.x || mundo?.y !== pontoAtual?.y) {
      pontoAtual = mundo && { x: mundo.x, y: mundo.y };
      opcoes.aoMoverPonteiro(pontoAtual);
    }

    const hex = pontoAtual ? mundoParaHex(pontoAtual) : null;
    if (hex?.q !== hexAtual?.q || hex?.r !== hexAtual?.r) {
      hexAtual = hex;
      destaque.atualizar(hex);
      opcoes.aoMudarHexSobMouse(hex);
    }
  });

  const limparPrevia = () => {
    tiles.limparPrevia();
    decoracoes.limparPrevia();
  };

  return {
    mundoEm: (x, y) => {
      const mundo = camera.toWorld(x, y);
      return { x: mundo.x, y: mundo.y };
    },
    mostrarPrevia: (assetId, coord) => {
      decoracoes.limparPrevia();
      tiles.mostrarPrevia(assetId, coord);
    },
    mostrarPreviaDecoracao: (assetId, posicao) => {
      tiles.limparPrevia();
      decoracoes.mostrarPrevia(assetId, posicao);
    },
    limparPrevia,
    decoracaoEm: decoracoes.decoracaoEm,
    moverDecoracaoVisual: decoracoes.moverVisual,
    sincronizarDecoracoes: () => decoracoes.atualizar(opcoes.loja.obterEstado()),
    cancelarAssinatura,
  };
}
