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

/** O quanto os jogadores conhecem de um hex: tudo o que é público, só a paisagem, ou nada. */
export type NivelDeVisao = 'completo' | 'avistado' | 'oculto';

function chavesDePosicao(posicoes: readonly CoordHex[]): ReadonlySet<ChaveHex> {
  return new Set(posicoes.map(chaveHex));
}

function chavesVizinhas(posicoes: readonly CoordHex[]): ReadonlySet<ChaveHex> {
  return new Set(posicoes.flatMap(vizinhosHex).map(chaveHex));
}

function calcularNivel(
  hex: Hex,
  posicoes: ReadonlySet<ChaveHex>,
  vizinhas: ReadonlySet<ChaveHex>,
): NivelDeVisao {
  const chave = chaveHex(hex.coord);
  if (posicoes.has(chave)) {
    return 'completo';
  }
  return vizinhas.has(chave) || hex.revelado ? 'avistado' : 'oculto';
}

export function nivelDeVisao(hex: Hex, posicoes: readonly CoordHex[]): NivelDeVisao {
  return calcularNivel(hex, chavesDePosicao(posicoes), chavesVizinhas(posicoes));
}

/**
 * O mapa como um jogador pode vê-lo, a partir de onde o grupo está: o hex da posição,
 * os 6 vizinhos e os hexes revelados pelo mestre. Os demais hexes simplesmente não existem aqui.
 */
export function visaoDoJogador(
  estado: EstadoMapa,
  posicoes: readonly CoordHex[],
): EstadoMapa {
  const chavesPosicao = chavesDePosicao(posicoes);
  const vizinhas = chavesVizinhas(posicoes);
  const hexes: Record<ChaveHex, Hex> = {};

  for (const hex of Object.values(estado.hexes)) {
    const nivel = calcularNivel(hex, chavesPosicao, vizinhas);
    if (nivel !== 'oculto') {
      hexes[chaveHex(hex.coord)] = nivel === 'completo' ? hexCompleto(hex) : hexAvistado(hex);
    }
  }

  return { ...estado, hexes };
}
