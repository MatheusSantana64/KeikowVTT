/** O que aparece no lugar dos hexes que os jogadores não veem. */
export type FundoOculto =
  | { readonly tipo: 'escuro'; readonly grid: boolean }
  | { readonly tipo: 'neblina'; readonly variante: 'clara' | 'escura' }
  | { readonly tipo: 'tile'; readonly assetId: string };

export interface AparenciaOculta {
  readonly fundo: FundoOculto;
  /** Faz os hexes visíveis se dissolverem no fundo. Não se aplica a tiles. */
  readonly bordasSuaves: boolean;
}

export const APARENCIA_PADRAO: AparenciaOculta = {
  fundo: { tipo: 'escuro', grid: false },
  bordasSuaves: false,
};

export function aparenciasIguais(a: AparenciaOculta, b: AparenciaOculta): boolean {
  return a.bordasSuaves === b.bordasSuaves && JSON.stringify(a.fundo) === JSON.stringify(b.fundo);
}
