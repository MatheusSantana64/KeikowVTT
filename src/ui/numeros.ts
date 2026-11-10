import { formatarNumero } from '../core/formulas';
import { numeroBrasileiro } from '../core/unidades';

/** Um número como se lê no Brasil: "7,5", "1.500". Infinito vira "ilimitado". */
export function numeroNaTela(valor: number): string {
  return Number.isFinite(valor) ? numeroBrasileiro(valor) : formatarNumero(valor);
}
