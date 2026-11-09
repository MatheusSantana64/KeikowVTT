import { Graphics } from 'pixi.js';
import { contornoHex, hexesNaArea, type AreaMundo, type CoordHex } from '../core/hex';

const COR_GRID = 0x6f7690;
const COR_DESTAQUE = 0xf0c870;
/** Quanto do mundo além da tela já fica desenhado, para não redesenhar a cada movimento. */
const MARGEM_DESENHO = 768;

function contem(externa: AreaMundo, interna: AreaMundo): boolean {
  return (
    interna.minX >= externa.minX &&
    interna.minY >= externa.minY &&
    interna.maxX <= externa.maxX &&
    interna.maxY <= externa.maxY
  );
}

/** Linhas do grid. Só desenha os hexes perto da área visível, pois o mapa não tem limite. */
export function criarCamadaGrid() {
  const grafico = new Graphics();
  let areaDesenhada: AreaMundo | null = null;

  const atualizar = (visivel: AreaMundo) => {
    if (areaDesenhada && contem(areaDesenhada, visivel)) {
      return;
    }
    const area: AreaMundo = {
      minX: visivel.minX - MARGEM_DESENHO,
      minY: visivel.minY - MARGEM_DESENHO,
      maxX: visivel.maxX + MARGEM_DESENHO,
      maxY: visivel.maxY + MARGEM_DESENHO,
    };
    grafico.clear();
    for (const coord of hexesNaArea(area)) {
      grafico.poly(contornoHex(coord));
    }
    grafico.stroke({ width: 1, color: COR_GRID, alpha: 0.45, pixelLine: true });
    areaDesenhada = area;
  };

  return { grafico, atualizar };
}

/** Realce do hex que está sob o mouse. */
export function criarDestaqueHex() {
  const grafico = new Graphics();

  const atualizar = (coord: CoordHex | null) => {
    grafico.clear();
    if (coord) {
      grafico
        .poly(contornoHex(coord))
        .fill({ color: COR_DESTAQUE, alpha: 0.18 })
        .stroke({ width: 2, color: COR_DESTAQUE });
    }
  };

  return { grafico, atualizar };
}
