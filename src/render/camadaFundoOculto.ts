import { Container, Sprite, Texture, TilingSprite } from 'pixi.js';
import type { AparenciaOculta, FundoOculto } from '../core/aparencia';
import {
  chaveHex,
  hexesNaArea,
  hexParaMundo,
  pontaInferiorHex,
  vizinhosHex,
  type AreaMundo,
  type CoordHex,
} from '../core/hex';
import { criarSpriteDoAsset, type Catalogo } from './assets';

const FUNDO_PADRAO = 0x14161c;
const FUNDO_SEM_TILE: FundoOculto = { tipo: 'escuro', grid: false };
const MARGEM_DESENHO = 768;
const TAMANHO_TEXTURA_NEBLINA = 512;

const CORES_NEBLINA = {
  clara: { fundo: 0x59616e, nuvem: 0xffffff, borda: 0xb4b8c2 },
  escura: { fundo: 0x1b1f28, nuvem: 0x8a93a6, borda: 0x4e5464 },
} as const;

function criarTexturaNeblina(): Texture {
  const tamanho = TAMANHO_TEXTURA_NEBLINA;
  const tela = document.createElement('canvas');
  tela.width = tamanho;
  tela.height = tamanho;
  const contexto = tela.getContext('2d')!;
  for (let i = 0; i < 110; i++) {
    const x = Math.random() * tamanho;
    const y = Math.random() * tamanho;
    const raio = 40 + Math.random() * 110;
    const alfa = 0.04 + Math.random() * 0.12;
    // Repete nas bordas para a textura emendar sem costura.
    for (const dx of [-tamanho, 0, tamanho]) {
      for (const dy of [-tamanho, 0, tamanho]) {
        const gradiente = contexto.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, raio);
        gradiente.addColorStop(0, `rgba(255,255,255,${alfa})`);
        gradiente.addColorStop(1, 'rgba(255,255,255,0)');
        contexto.fillStyle = gradiente;
        contexto.fillRect(0, 0, tamanho, tamanho);
      }
    }
  }
  const textura = Texture.from(tela);
  textura.source.style.addressMode = 'repeat';
  return textura;
}

function criarTexturaBorda(): Texture {
  const tela = document.createElement('canvas');
  tela.width = 256;
  tela.height = 256;
  const contexto = tela.getContext('2d')!;
  const gradiente = contexto.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradiente.addColorStop(0, 'rgba(255,255,255,1)');
  gradiente.addColorStop(0.55, 'rgba(255,255,255,0.85)');
  gradiente.addColorStop(1, 'rgba(255,255,255,0)');
  contexto.fillStyle = gradiente;
  contexto.fillRect(0, 0, 256, 256);
  return Texture.from(tela);
}

function contem(externa: AreaMundo, interna: AreaMundo): boolean {
  return (
    interna.minX >= externa.minX &&
    interna.minY >= externa.minY &&
    interna.maxX <= externa.maxX &&
    interna.maxY <= externa.maxY
  );
}

function limpar(camada: Container): void {
  camada.removeChildren().forEach((filho) => filho.destroy());
}

/**
 * O que aparece no lugar dos hexes que os jogadores não veem. Cobre toda a área visível,
 * e não só os hexes com terreno, para que o formato do mundo não possa ser deduzido.
 */
export function criarCamadaFundoOculto(
  catalogo: Catalogo,
  definirCorDeFundo: (cor: number) => void,
) {
  /** Fica atrás de tudo. */
  const atras = new Container();
  /** Fica por cima dos hexes visíveis, dissolvendo as bordas deles. */
  const frente = new Container();
  const tilesOcultos = new Container();
  atras.addChild(tilesOcultos);

  let fundoAtual: FundoOculto | null = null;
  let neblinas: { fundo: TilingSprite; frente: TilingSprite } | null = null;
  let texturaBorda: Texture | null = null;
  let tileDesenhado: string | null = null;
  let areaTilesDesenhados: AreaMundo | null = null;
  let tempo = 0;

  const obterNeblinas = () => {
    if (!neblinas) {
      const textura = criarTexturaNeblina();
      neblinas = {
        fundo: new TilingSprite({ texture: textura, width: 1, height: 1 }),
        frente: new TilingSprite({ texture: textura, width: 1, height: 1 }),
      };
      neblinas.fundo.tileScale.set(2.4);
      neblinas.frente.tileScale.set(1.3);
      atras.addChild(neblinas.fundo, neblinas.frente);
    }
    return neblinas;
  };

  const limparTiles = () => {
    limpar(tilesOcultos);
    tileDesenhado = null;
    areaTilesDesenhados = null;
  };

  /** Se a imagem escolhida não existir mais, usa o fundo escuro. */
  const fundoEfetivo = (fundo: FundoOculto): FundoOculto =>
    fundo.tipo === 'tile' && !catalogo.assets.has(fundo.assetId) ? FUNDO_SEM_TILE : fundo;

  const desenharBordas = (fundo: FundoOculto, visiveis: readonly CoordHex[]) => {
    limpar(frente);
    if (fundo.tipo === 'tile') {
      return;
    }
    texturaBorda ??= criarTexturaBorda();
    const chavesVisiveis = new Set(visiveis.map(chaveHex));
    const anel = new Map<string, CoordHex>();
    for (const coord of visiveis.flatMap(vizinhosHex)) {
      if (!chavesVisiveis.has(chaveHex(coord))) {
        anel.set(chaveHex(coord), coord);
      }
    }
    const cor = fundo.tipo === 'neblina' ? CORES_NEBLINA[fundo.variante].borda : FUNDO_PADRAO;
    for (const coord of anel.values()) {
      const borda = new Sprite(texturaBorda);
      const centro = hexParaMundo(coord);
      borda.anchor.set(0.5);
      borda.position.set(centro.x, centro.y);
      borda.width = 400;
      borda.height = 370;
      borda.tint = cor;
      frente.addChild(borda);
    }
  };

  /**
   * Aplica a aparência, ou desliga tudo se receber `null` (visão do mestre).
   * Devolve se as linhas do grid devem aparecer.
   */
  const atualizar = (
    aparencia: AparenciaOculta | null,
    visiveis: readonly CoordHex[],
  ): boolean => {
    fundoAtual = aparencia && fundoEfetivo(aparencia.fundo);
    const neblinaAtiva = fundoAtual?.tipo === 'neblina' ? fundoAtual : null;

    if (neblinaAtiva) {
      const { fundo, frente: nuvens } = obterNeblinas();
      const { nuvem } = CORES_NEBLINA[neblinaAtiva.variante];
      fundo.tint = nuvem;
      nuvens.tint = nuvem;
    }
    if (neblinas) {
      neblinas.fundo.visible = neblinaAtiva !== null;
      neblinas.frente.visible = neblinaAtiva !== null;
    }
    if (fundoAtual?.tipo !== 'tile') {
      limparTiles();
    }
    definirCorDeFundo(neblinaAtiva ? CORES_NEBLINA[neblinaAtiva.variante].fundo : FUNDO_PADRAO);

    if (fundoAtual && aparencia?.bordasSuaves) {
      desenharBordas(fundoAtual, visiveis);
    } else {
      limpar(frente);
    }

    return fundoAtual === null || (fundoAtual.tipo === 'escuro' && fundoAtual.grid);
  };

  const atualizarTiles = (assetId: string, visivel: AreaMundo) => {
    if (tileDesenhado === assetId && areaTilesDesenhados && contem(areaTilesDesenhados, visivel)) {
      return;
    }
    limparTiles();
    tileDesenhado = assetId;
    areaTilesDesenhados = {
      minX: visivel.minX - MARGEM_DESENHO,
      minY: visivel.minY - MARGEM_DESENHO,
      maxX: visivel.maxX + MARGEM_DESENHO,
      maxY: visivel.maxY + MARGEM_DESENHO,
    };
    for (const coord of hexesNaArea(areaTilesDesenhados)) {
      const sprite = criarSpriteDoAsset(catalogo, assetId);
      if (sprite) {
        const ponta = pontaInferiorHex(coord);
        sprite.position.set(ponta.x, ponta.y);
        tilesOcultos.addChild(sprite);
      }
    }
  };

  const moverNeblina = (neblina: TilingSprite, visivel: AreaMundo, velocidade: number) => {
    neblina.position.set(visivel.minX, visivel.minY);
    neblina.width = visivel.maxX - visivel.minX;
    neblina.height = visivel.maxY - visivel.minY;
    neblina.tilePosition.set(
      -visivel.minX + tempo * velocidade,
      -visivel.minY + tempo * velocidade * 0.5,
    );
  };

  /** Acompanha a câmera e anima a neblina. Deve ser chamada a cada quadro. */
  const aoQuadro = (visivel: AreaMundo, milissegundos: number) => {
    if (fundoAtual?.tipo === 'tile') {
      atualizarTiles(fundoAtual.assetId, visivel);
    } else if (fundoAtual?.tipo === 'neblina' && neblinas) {
      tempo += milissegundos / 1000;
      moverNeblina(neblinas.fundo, visivel, 14);
      moverNeblina(neblinas.frente, visivel, -24);
    }
  };

  return { atras, frente, atualizar, aoQuadro };
}
