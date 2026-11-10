import { createContext, useContext } from 'react';
import type { Regras } from '../core/regras';
import { REGRAS_PADRAO } from '../core/regrasPadrao';

/** As regras da campanha aberta, para qualquer tela que calcule ou confira fórmulas. */
export const ContextoRegras = createContext<Regras>(REGRAS_PADRAO);

export function useRegras(): Regras {
  return useContext(ContextoRegras);
}
