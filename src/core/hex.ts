/** Identidade de um hex no mapa, em coordenadas axiais. */
export interface CoordHex {
  readonly q: number;
  readonly r: number;
}

/** Posição em pixels no "mundo" do mapa, antes de câmera e zoom. */
export interface PontoMundo {
  readonly x: number;
  readonly y: number;
}

export type ChaveHex = `${number},${number}`;

/** Distância horizontal entre os centros de dois hexes vizinhos na mesma linha. */
export const LARGURA_COLUNA = 256;
/** Distância vertical entre duas linhas de hexes. */
export const ALTURA_LINHA = 192;

export function chaveHex({ q, r }: CoordHex): ChaveHex {
  return `${q},${r}`;
}

export function coordDaChave(chave: ChaveHex): CoordHex {
  const [q, r] = chave.split(',').map(Number);
  return { q, r };
}

/** Centro do "chão" do hex, em pixels do mundo. */
export function hexParaMundo({ q, r }: CoordHex): PontoMundo {
  return { x: LARGURA_COLUNA * (q + r / 2), y: ALTURA_LINHA * r };
}

/** Hex que contém um ponto do mundo. */
export function mundoParaHex({ x, y }: PontoMundo): CoordHex {
  const r = y / ALTURA_LINHA;
  const q = x / LARGURA_COLUNA - r / 2;
  return arredondarHex(q, r);
}

/**
 * Arredonda coordenadas fracionárias para o hex mais próximo. Usa a terceira
 * coordenada (s = -q - r): a que mais se afastou do inteiro é recalculada
 * a partir das outras duas, o que mantém a soma das três igual a zero.
 */
function arredondarHex(q: number, r: number): CoordHex {
  const s = -q - r;
  let qInteiro = Math.round(q);
  let rInteiro = Math.round(r);
  const sInteiro = Math.round(s);

  const erroQ = Math.abs(qInteiro - q);
  const erroR = Math.abs(rInteiro - r);
  const erroS = Math.abs(sInteiro - s);

  if (erroQ > erroR && erroQ > erroS) {
    qInteiro = -rInteiro - sInteiro;
  } else if (erroR > erroS) {
    rInteiro = -qInteiro - sInteiro;
  }

  // Somar 0 transforma -0 em 0.
  return { q: qInteiro + 0, r: rInteiro + 0 };
}
