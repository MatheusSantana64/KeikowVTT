import { chaveHex, vizinhosHex, type ChaveHex, type CoordHex } from './hex';
import { INFORMACAO_VAZIA, type EstadoMapa, type Hex } from './mapa';

/** Quem pode ver uma informação. É um objeto para aceitar, no futuro, um jogador específico. */
export type Visibilidade = { readonly tipo: 'todos' } | { readonly tipo: 'mestre' };

export const VISIVEL_A_TODOS: Visibilidade = { tipo: 'todos' };
export const SO_MESTRE: Visibilidade = { tipo: 'mestre' };

/** O hex onde o grupo está: tudo o que é público. */
function hexCompleto(hex: Hex): Hex {
  return {
    ...hex,
    revelado: false,
    notas: hex.notas.filter((nota) => nota.visibilidade.tipo === 'todos'),
  };
}

/** Um hex avistado de longe: só terreno e decorações. */
function hexAvistado(hex: Hex): Hex {
  return { ...hex, ...INFORMACAO_VAZIA, revelado: false };
}

/**
 * O mapa como um jogador pode vê-lo, a partir de onde o grupo está: o hex da posição,
 * os 6 vizinhos e os hexes revelados pelo mestre. Os demais hexes simplesmente não existem aqui.
 */
export function visaoDoJogador(
  estado: EstadoMapa,
  posicoes: readonly CoordHex[],
): EstadoMapa {
  const chavesPosicao = new Set(posicoes.map(chaveHex));
  const chavesVizinhas = new Set(posicoes.flatMap(vizinhosHex).map(chaveHex));
  const hexes: Record<ChaveHex, Hex> = {};

  for (const hex of Object.values(estado.hexes)) {
    const chave = chaveHex(hex.coord);
    if (chavesPosicao.has(chave)) {
      hexes[chave] = hexCompleto(hex);
    } else if (chavesVizinhas.has(chave) || hex.revelado) {
      hexes[chave] = hexAvistado(hex);
    }
  }

  return { ...estado, hexes };
}
