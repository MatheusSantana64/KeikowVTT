import { Application } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { mundoParaHex, type CoordHex } from '../core/hex';
import type { LojaMapa } from '../core/loja';
import type { Manifesto } from '../core/manifesto';
import { carregarCatalogo, type Catalogo } from './assets';
import { criarCamadaGrid, criarDestaqueHex } from './camadaGrid';
import { criarCamadaTiles } from './camadaTiles';

const ZOOM_MINIMO = 0.15;
const ZOOM_MAXIMO = 2;
const ZOOM_INICIAL = 0.6;

export interface OpcoesCena {
  readonly loja: LojaMapa;
  readonly manifesto: Manifesto;
  /** Chamada quando o hex sob o mouse muda; recebe `null` quando o mouse sai do mapa. */
  readonly aoMudarHexSobMouse: (coord: CoordHex | null) => void;
}

interface ControlesCena {
  /** Hex em uma posição da tela, relativa ao canto do mapa. */
  hexEm(x: number, y: number): CoordHex;
  mostrarPrevia(assetId: string, coord: CoordHex): void;
  limparPrevia(): void;
  cancelarAssinatura(): void;
}

export interface CenaMapa extends Omit<ControlesCena, 'hexEm' | 'cancelarAssinatura'> {
  /** Devolve `null` enquanto a cena ainda está carregando. */
  hexEm(x: number, y: number): CoordHex | null;
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
    hexEm: (x, y) => controles?.hexEm(x, y) ?? null,
    mostrarPrevia: (assetId, coord) => controles?.mostrarPrevia(assetId, coord),
    limparPrevia: () => controles?.limparPrevia(),
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
  // O botão esquerdo fica livre para colocar e pintar tiles.
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
  const destaque = criarDestaqueHex();
  camera.addChild(grid.grafico, tiles.container, destaque.grafico);

  tiles.atualizar(opcoes.loja.obterEstado());
  const cancelarAssinatura = opcoes.loja.assinar(tiles.atualizar);

  let ponteiro: { x: number; y: number } | null = null;
  app.canvas.addEventListener('pointermove', (evento) => {
    ponteiro = { x: evento.offsetX, y: evento.offsetY };
  });
  app.canvas.addEventListener('pointerleave', () => {
    ponteiro = null;
  });

  let hexAtual: CoordHex | null = null;
  // Roda a cada quadro para acompanhar também o zoom e o arrasto, com o mouse parado.
  app.ticker.add(() => {
    grid.atualizar({
      minX: camera.left,
      minY: camera.top,
      maxX: camera.right,
      maxY: camera.bottom,
    });

    const hex = ponteiro ? mundoParaHex(camera.toWorld(ponteiro.x, ponteiro.y)) : null;
    if (hex?.q !== hexAtual?.q || hex?.r !== hexAtual?.r) {
      hexAtual = hex;
      destaque.atualizar(hex);
      opcoes.aoMudarHexSobMouse(hex);
    }
  });

  return {
    hexEm: (x, y) => mundoParaHex(camera.toWorld(x, y)),
    mostrarPrevia: tiles.mostrarPrevia,
    limparPrevia: tiles.limparPrevia,
    cancelarAssinatura,
  };
}
