import type { EstadoMapa, Hex } from './mapa';

/** Quem pode ver uma informação. É um objeto para aceitar, no futuro, um jogador específico. */
export type Visibilidade = { readonly tipo: 'todos' } | { readonly tipo: 'mestre' };

export const VISIVEL_A_TODOS: Visibilidade = { tipo: 'todos' };
export const SO_MESTRE: Visibilidade = { tipo: 'mestre' };

function hexVistoPeloJogador(hex: Hex): Hex {
  return { ...hex, notas: hex.notas.filter((nota) => nota.visibilidade.tipo === 'todos') };
}

/** O mapa como um jogador pode vê-lo, sem nenhuma informação restrita ao mestre. */
export function visaoDoJogador(estado: EstadoMapa): EstadoMapa {
  const hexes = Object.fromEntries(
    Object.entries(estado.hexes).map(([chave, hex]) => [chave, hexVistoPeloJogador(hex)]),
  );
  return { hexes };
}
