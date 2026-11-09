import { Container, type Sprite } from 'pixi.js';
import { hexParaMundo, type CoordHex, type PontoMundo } from '../core/hex';
import type { EstadoMapa } from '../core/mapa';
import type { Asset } from '../core/manifesto';
import { criarSpriteDoAsset, type Catalogo } from './assets';

interface DecoracaoDesenhada {
  readonly sprite: Sprite;
  readonly asset: Asset;
  coord: CoordHex;
}

export interface DecoracaoEncontrada {
  readonly decoracaoId: string;
  readonly assetId: string;
  readonly coord: CoordHex;
  readonly posicao: PontoMundo;
}

interface MascaraAlfa {
  readonly largura: number;
  readonly dados: Uint8ClampedArray;
}

const OPACIDADE_PREVIA = 0.7;
/** Abaixo desta opacidade (0 a 255), o pixel conta como vazio ao clicar. */
const ALFA_MINIMO_CLIQUE = 40;
const Z_PREVIA = Number.MAX_SAFE_INTEGER;
/** Entre o tile da própria linha e os tiles da linha seguinte. */
const AJUSTE_Z_SOBREPOSICAO = 0.25;

/**
 * Desenha as decorações por cima dos tiles. Os rios ficam em `containerTerreno`,
 * misturados aos tiles, para que a arte alta das linhas da frente os cubra.
 */
export function criarCamadaDecoracoes(catalogo: Catalogo, containerTerreno: Container) {
  const container = new Container({ sortableChildren: true });
  const desenhadas = new Map<string, DecoracaoDesenhada>();
  const mascaras = new Map<string, MascaraAlfa | null>();
  let previa: { assetId: string; sprite: Sprite } | null = null;

  const criarDesenhada = (decoracaoId: string, assetId: string, coord: CoordHex) => {
    const asset = catalogo.assets.get(assetId);
    const sprite = criarSpriteDoAsset(catalogo, assetId);
    if (!asset || !sprite) {
      return null;
    }
    (asset.tipo === 'sobreposicao' ? containerTerreno : container).addChild(sprite);
    const desenhada: DecoracaoDesenhada = { sprite, asset, coord };
    desenhadas.set(decoracaoId, desenhada);
    return desenhada;
  };

  const atualizar = (estado: EstadoMapa) => {
    const vistas = new Set<string>();

    for (const hex of Object.values(estado.hexes)) {
      const centro = hexParaMundo(hex.coord);
      for (const decoracao of hex.decoracoes) {
        const desenhada =
          desenhadas.get(decoracao.id) ??
          criarDesenhada(decoracao.id, decoracao.assetId, hex.coord);
        if (!desenhada) {
          continue;
        }
        vistas.add(decoracao.id);
        desenhada.coord = hex.coord;
        const x = centro.x + decoracao.deslocamento.x;
        const y = centro.y + decoracao.deslocamento.y;
        desenhada.sprite.position.set(x, y);
        desenhada.sprite.zIndex =
          desenhada.asset.tipo === 'sobreposicao' ? hex.coord.r + AJUSTE_Z_SOBREPOSICAO : y;
      }
    }

    for (const [id, desenhada] of desenhadas) {
      if (!vistas.has(id)) {
        desenhada.sprite.destroy();
        desenhadas.delete(id);
      }
    }
  };

  const obterMascara = (desenhada: DecoracaoDesenhada): MascaraAlfa | null => {
    const { asset, sprite } = desenhada;
    if (!mascaras.has(asset.id)) {
      const tela = document.createElement('canvas');
      tela.width = asset.largura;
      tela.height = asset.altura;
      const contexto = tela.getContext('2d');
      contexto?.drawImage(sprite.texture.source.resource as CanvasImageSource, 0, 0);
      const imagem = contexto?.getImageData(0, 0, asset.largura, asset.altura);
      mascaras.set(asset.id, imagem ? { largura: imagem.width, dados: imagem.data } : null);
    }
    return mascaras.get(asset.id) ?? null;
  };

  const pixelVisivelEm = (desenhada: DecoracaoDesenhada, ponto: PontoMundo): boolean => {
    const { asset, sprite } = desenhada;
    const x = Math.floor(asset.ancora.x + (ponto.x - sprite.x) / asset.escala);
    const y = Math.floor(asset.ancora.y + (ponto.y - sprite.y) / asset.escala);
    if (x < 0 || y < 0 || x >= asset.largura || y >= asset.altura) {
      return false;
    }
    const mascara = obterMascara(desenhada);
    return mascara !== null && mascara.dados[(y * mascara.largura + x) * 4 + 3] >= ALFA_MINIMO_CLIQUE;
  };

  /** A decoração visível mais à frente neste ponto. Os rios têm a menor prioridade. */
  const decoracaoEm = (ponto: PontoMundo): DecoracaoEncontrada | null => {
    const candidatas = [...desenhadas.entries()].sort(([, a], [, b]) => {
      const aRio = a.asset.tipo === 'sobreposicao';
      const bRio = b.asset.tipo === 'sobreposicao';
      return aRio === bRio ? b.sprite.zIndex - a.sprite.zIndex : aRio ? 1 : -1;
    });
    for (const [decoracaoId, desenhada] of candidatas) {
      if (pixelVisivelEm(desenhada, ponto)) {
        return {
          decoracaoId,
          assetId: desenhada.asset.id,
          coord: desenhada.coord,
          posicao: { x: desenhada.sprite.x, y: desenhada.sprite.y },
        };
      }
    }
    return null;
  };

  /** Move só o desenho, enquanto a decoração está sendo arrastada. */
  const moverVisual = (decoracaoId: string, posicao: PontoMundo) => {
    desenhadas.get(decoracaoId)?.sprite.position.set(posicao.x, posicao.y);
  };

  const limparPrevia = () => {
    previa?.sprite.destroy();
    previa = null;
  };

  const mostrarPrevia = (assetId: string, posicao: PontoMundo) => {
    if (previa?.assetId !== assetId) {
      limparPrevia();
      const sprite = criarSpriteDoAsset(catalogo, assetId);
      if (!sprite) {
        return;
      }
      sprite.alpha = OPACIDADE_PREVIA;
      sprite.zIndex = Z_PREVIA;
      container.addChild(sprite);
      previa = { assetId, sprite };
    }
    previa!.sprite.position.set(posicao.x, posicao.y);
  };

  return { container, atualizar, decoracaoEm, moverVisual, mostrarPrevia, limparPrevia };
}
