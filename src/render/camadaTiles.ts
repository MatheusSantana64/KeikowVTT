import { Container, type Sprite } from 'pixi.js';
import { pontaInferiorHex, type CoordHex } from '../core/hex';
import type { EstadoMapa } from '../core/mapa';
import { criarSpriteDoAsset, type Catalogo } from './assets';

interface TileDesenhado {
  readonly terreno: string;
  readonly sprite: Sprite;
}

const OPACIDADE_PREVIA = 0.7;
const COR_ORIGINAL = 0xffffff;

function posicionarNoHex(sprite: Sprite, coord: CoordHex): void {
  const ponta = pontaInferiorHex(coord);
  sprite.position.set(ponta.x, ponta.y);
  // Linhas de cima ficam atrás, para a arte alta sobrepor corretamente.
  sprite.zIndex = coord.r;
}

/** Desenha os tiles do mapa, recriando apenas os que mudaram. */
export function criarCamadaTiles(catalogo: Catalogo) {
  const container = new Container({ sortableChildren: true });
  const desenhados = new Map<string, TileDesenhado>();
  let previa: { assetId: string; sprite: Sprite } | null = null;

  const removerDesenhado = (chave: string, tile: TileDesenhado) => {
    tile.sprite.destroy();
    desenhados.delete(chave);
  };

  const atualizar = (estado: EstadoMapa) => {
    for (const [chave, tile] of desenhados) {
      if (!(chave in estado.hexes)) {
        removerDesenhado(chave, tile);
      }
    }

    for (const [chave, hex] of Object.entries(estado.hexes)) {
      const atual = desenhados.get(chave);
      if (atual?.terreno === hex.terreno) {
        continue;
      }
      if (atual) {
        removerDesenhado(chave, atual);
      }
      const sprite = criarSpriteDoAsset(catalogo, hex.terreno);
      if (sprite) {
        posicionarNoHex(sprite, hex.coord);
        container.addChild(sprite);
        desenhados.set(chave, { terreno: hex.terreno, sprite });
      }
    }
  };

  /** Pinta com `cor` os tiles de `chaves`; os demais ficam com a cor original. */
  const escurecer = (chaves: ReadonlySet<string> | null, cor: number) => {
    for (const [chave, tile] of desenhados) {
      tile.sprite.tint = chaves?.has(chave) ? cor : COR_ORIGINAL;
    }
  };

  const limparPrevia = () => {
    previa?.sprite.destroy();
    previa = null;
  };

  const mostrarPrevia = (assetId: string, coord: CoordHex) => {
    if (previa?.assetId !== assetId) {
      limparPrevia();
      const sprite = criarSpriteDoAsset(catalogo, assetId);
      if (!sprite) {
        return;
      }
      sprite.alpha = OPACIDADE_PREVIA;
      container.addChild(sprite);
      previa = { assetId, sprite };
    }
    posicionarNoHex(previa!.sprite, coord);
    // Fica sobre o tile da própria linha, mas atrás das linhas de baixo.
    previa!.sprite.zIndex = coord.r + 0.5;
  };

  return { container, atualizar, escurecer, mostrarPrevia, limparPrevia };
}
