import type { FundoOculto } from '../core/aparencia';

export type IdOpcaoAparencia =
  | 'escuro'
  | 'escuro-grid'
  | 'neblina-clara'
  | 'neblina-escura'
  | 'void'
  | 'tile';

export const TILE_VOID = 'hexVoid00';
/** Tile sugerido ao escolher "Outro tile" pela primeira vez. */
export const TILE_INICIAL = 'hexBase00';

export const OPCOES_APARENCIA: readonly { readonly id: IdOpcaoAparencia; readonly rotulo: string }[] =
  [
    { id: 'escuro', rotulo: 'Fundo escuro' },
    { id: 'escuro-grid', rotulo: 'Fundo escuro com grid' },
    { id: 'neblina-clara', rotulo: 'Neblina clara' },
    { id: 'neblina-escura', rotulo: 'Neblina escura' },
    { id: 'void', rotulo: 'Vazio estrelado (void)' },
    { id: 'tile', rotulo: 'Outro tile' },
  ];

export function opcaoDoFundo(fundo: FundoOculto): IdOpcaoAparencia {
  switch (fundo.tipo) {
    case 'escuro':
      return fundo.grid ? 'escuro-grid' : 'escuro';
    case 'neblina':
      return fundo.variante === 'clara' ? 'neblina-clara' : 'neblina-escura';
    case 'tile':
      return fundo.assetId === TILE_VOID ? 'void' : 'tile';
  }
}

/** `tileEscolhido` é o tile usado pela opção "Outro tile". */
export function fundoDaOpcao(id: IdOpcaoAparencia, tileEscolhido: string): FundoOculto {
  switch (id) {
    case 'escuro':
      return { tipo: 'escuro', grid: false };
    case 'escuro-grid':
      return { tipo: 'escuro', grid: true };
    case 'neblina-clara':
      return { tipo: 'neblina', variante: 'clara' };
    case 'neblina-escura':
      return { tipo: 'neblina', variante: 'escura' };
    case 'void':
      return { tipo: 'tile', assetId: TILE_VOID };
    case 'tile':
      return { tipo: 'tile', assetId: tileEscolhido };
  }
}
