import { Application, Container, Sprite } from 'pixi.js';
import { hexParaMundo, pontaInferiorHex, type CoordHex, type PontoMundo } from '../core/hex';
import type { Asset } from '../core/manifesto';
import type { AssetsCarregados } from './assets';

const COLUNAS = 7;
const MARGEM_DECORACOES = 40;
/** Espaço abaixo do centro da última linha, descontando as bases, até as decorações. */
const DISTANCIA_DECORACOES = 340;

/** Tela de teste temporária: mostra todos os assets encaixados no grid. */
export function desenharGaleria(app: Application, { manifesto, texturas }: AssetsCarregados): void {
  const mundo = new Container();
  app.stage.addChild(mundo);

  const criarSprite = (asset: Asset, posicao: PontoMundo) => {
    const sprite = new Sprite(texturas.get(asset.id));
    sprite.anchor.set(asset.ancora.x / asset.largura, asset.ancora.y / asset.altura);
    sprite.scale.set(asset.escala);
    sprite.position.set(posicao.x, posicao.y);
    mundo.addChild(sprite);
    return sprite;
  };

  const tiles = manifesto.assets.filter((a) => a.tipo === 'tile');
  const bases = manifesto.assets.filter((a) => a.tipo === 'base');
  const decoracoes = manifesto.assets.filter((a) => a.tipo === 'decoracao');

  const sobreposicoes = manifesto.assets.filter((a) => a.tipo === 'sobreposicao');
  const terrenoDeFundo = tiles.find((a) => a.id === 'hexPlains00')!;

  // Cada sobreposição ganha um hex de planície só para ser vista sobre um terreno.
  const tilesDaGaleria = [...tiles, ...sobreposicoes.map(() => terrenoDeFundo)];
  const coords = tilesDaGaleria.map((_, indice) => coordDaGaleria(indice));
  const ultimaLinha = coords[coords.length - 1].r;

  // As bases ficam na última linha e são desenhadas antes para ficar atrás dos tiles.
  coords
    .filter((coord) => coord.r === ultimaLinha)
    .forEach((coord, indice) => criarSprite(bases[indice % bases.length], pontaInferiorHex(coord)));

  // A lista está em ordem de linhas, de cima para baixo: a arte alta sobrepõe o que está atrás.
  tilesDaGaleria.forEach((tile, indice) => criarSprite(tile, pontaInferiorHex(coords[indice])));
  sobreposicoes.forEach((asset, indice) => criarSprite(asset, hexParaMundo(coords[tiles.length + indice])));

  const y = hexParaMundo(coords[coords.length - 1]).y + DISTANCIA_DECORACOES;
  let x = hexParaMundo(coords[0]).x;
  for (const decoracao of decoracoes) {
    criarSprite(decoracao, { x: x + decoracao.largura / 2, y });
    x += decoracao.largura + MARGEM_DECORACOES;
  }

  const ajustarNaTela = () => {
    const limites = mundo.getLocalBounds();
    const escala = 0.95 * Math.min(app.screen.width / limites.width, app.screen.height / limites.height);
    mundo.scale.set(escala);
    mundo.position.set(
      (app.screen.width - limites.width * escala) / 2 - limites.x * escala,
      (app.screen.height - limites.height * escala) / 2 - limites.y * escala,
    );
  };
  ajustarNaTela();
  app.renderer.on('resize', ajustarNaTela);
}

function coordDaGaleria(indice: number): CoordHex {
  const r = Math.floor(indice / COLUNAS);
  const coluna = indice % COLUNAS;
  return { q: coluna - Math.floor(r / 2), r };
}
