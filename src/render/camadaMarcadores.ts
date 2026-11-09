import { Graphics } from 'pixi.js';
import { hexParaMundo } from '../core/hex';
import { temAnotacoes, type EstadoMapa } from '../core/mapa';

const COR_FUNDO = 0x1d2029;
const COR_MARCADOR = 0xf0c870;
const RAIO = 24;
/** Posição do marcador em relação ao centro do hex: no canto superior direito do chão. */
const DESLOCAMENTO_X = 72;
const DESLOCAMENTO_Y = -56;
const MEIA_LARGURA_LINHA = 11;
const ALTURAS_DAS_LINHAS = [-8, 0, 8];

/** Mostra quais hexes têm anotações, com um pequeno ícone de texto. */
export function criarCamadaMarcadores() {
  const grafico = new Graphics();

  const atualizar = (estado: EstadoMapa) => {
    grafico.clear();
    for (const hex of Object.values(estado.hexes)) {
      if (!temAnotacoes(hex)) {
        continue;
      }
      const centro = hexParaMundo(hex.coord);
      const x = centro.x + DESLOCAMENTO_X;
      const y = centro.y + DESLOCAMENTO_Y;
      grafico
        .circle(x, y, RAIO)
        .fill(COR_FUNDO)
        .stroke({ width: 4, color: COR_MARCADOR });
      for (const altura of ALTURAS_DAS_LINHAS) {
        grafico
          .moveTo(x - MEIA_LARGURA_LINHA, y + altura)
          .lineTo(x + MEIA_LARGURA_LINHA, y + altura)
          .stroke({ width: 4, color: COR_MARCADOR });
      }
    }
  };

  return { grafico, atualizar };
}
