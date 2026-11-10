/**
 * O programa usa o sistema métrico. O SRD usa o imperial; as conversões seguem
 * a edição brasileira do 5e, que arredonda para números fáceis de usar na mesa.
 */
export const METROS_POR_PE = 0.3;
export const QUILOS_POR_LIBRA = 0.5;
export const KM_POR_MILHA = 1.5;
export const CM_POR_POLEGADA = 2.5;
export const LITROS_POR_GALAO = 4;
export const LITROS_POR_PINT = 0.5;
export const ML_POR_ONCA = 30;
/** Um pé quadrado e um pé cúbico, com o mesmo 0,3 m por pé. */
export const M2_POR_PE2 = METROS_POR_PE ** 2;
export const M3_POR_PE3 = METROS_POR_PE ** 3;

/** Arredonda as sobras da conta (0,3 × 5 dá 1,4999…) para no máximo duas casas. */
function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function pesParaMetros(pes: number): number {
  return arredondar(pes * METROS_POR_PE);
}

export function librasParaQuilos(libras: number): number {
  return arredondar(libras * QUILOS_POR_LIBRA);
}

/** Como se escreve no Brasil: vírgula nos decimais e ponto nos milhares. */
export function numeroBrasileiro(valor: number): string {
  return arredondar(valor).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

interface Unidade {
  /** Como a unidade aparece no texto, sem o número. */
  readonly padrao: string;
  readonly fator: number;
  /** Como fica depois do número: "m", "km", "kg"… */
  readonly simbolo: string;
  /** Na forma de adjetivo, como "20-foot-radius": "20-meter". */
  readonly adjetivo: string;
}

// A ordem importa: as compostas (pés quadrados) vêm antes das simples (pés).
const UNIDADES: readonly Unidade[] = [
  { padrao: 'square (?:feet|foot)', fator: M2_POR_PE2, simbolo: 'm²', adjetivo: 'square-meter' },
  { padrao: 'cubic (?:feet|foot)', fator: M3_POR_PE3, simbolo: 'm³', adjetivo: 'cubic-meter' },
  { padrao: '(?:feet|foot)', fator: METROS_POR_PE, simbolo: 'm', adjetivo: 'meter' },
  { padrao: 'ft\\.?', fator: METROS_POR_PE, simbolo: 'm', adjetivo: 'meter' },
  { padrao: 'miles?', fator: KM_POR_MILHA, simbolo: 'km', adjetivo: 'km' },
  { padrao: 'inch(?:es)?', fator: CM_POR_POLEGADA, simbolo: 'cm', adjetivo: 'cm' },
  { padrao: '(?:pounds?|lbs?\\.?)', fator: QUILOS_POR_LIBRA, simbolo: 'kg', adjetivo: 'kg' },
  { padrao: 'gallons?', fator: LITROS_POR_GALAO, simbolo: 'L', adjetivo: 'liter' },
  { padrao: 'pints?', fator: LITROS_POR_PINT, simbolo: 'L', adjetivo: 'liter' },
  { padrao: 'ounces?', fator: ML_POR_ONCA, simbolo: 'ml', adjetivo: 'ml' },
];

const NUMERO = '\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?';
/** Uma rolagem como quantidade: "1d6 + 1 ounces". */
const DADOS = '\\d+d\\d+(?:\\s*[+−-]\\s*\\d+)?';

function lerNumero(texto: string): number {
  return Number(texto.replace(/,/g, ''));
}

function converter(texto: string, fator: number): string {
  return numeroBrasileiro(lerNumero(texto) * fator);
}

/**
 * Troca medidas imperiais de um texto em inglês do SRD pelas métricas:
 * "within 60 feet" → "within 18 m"; "a 20-foot-radius sphere" → "a 6-meter-radius sphere";
 * "range 80/320 ft." → "range 24/96 m"; "-50 degrees Fahrenheit" → "-45 °C".
 * Textos sem medidas imperiais voltam iguais.
 */
export function textoParaMetrico(texto: string): string {
  let resultado = texto;

  // Temperatura: só aparece em graus Fahrenheit.
  resultado = resultado.replace(new RegExp(`(-?(?:${NUMERO})) degrees Fahrenheit`, 'gi'), (_t, n: string) => {
    const celsius = Math.round((((lerNumero(n) - 32) * 5) / 9) / 5) * 5;
    return `${numeroBrasileiro(celsius)} °C`;
  });

  for (const unidade of UNIDADES) {
    const u = unidade.padrao;
    // Rolagens: "1d6 + 1 ounces" vira "(1d6 + 1) × 30 ml".
    resultado = resultado.replace(
      new RegExp(`\\b(${DADOS})\\s+${u}(?!\\w|-\\w)`, 'gi'),
      (_t, dados: string) => `(${dados}) × ${numeroBrasileiro(unidade.fator)} ${unidade.simbolo}`,
    );
    // Duas medidas: "80/320 ft.", "5 to 20 feet", "3 ft. × 5 ft." (cada uma é trocada sozinha depois).
    resultado = resultado.replace(
      new RegExp(`\\b(${NUMERO})(\\s*/\\s*|\\s+to\\s+|\\s+or\\s+|\\s+and\\s+|\\s*[–-]\\s*)(${NUMERO})\\s*${u}(?!\\w|-\\w)`, 'gi'),
      (_t, a: string, entre: string, b: string) =>
        `${converter(a, unidade.fator)}${entre}${converter(b, unidade.fator)} ${unidade.simbolo}`,
    );
    // Adjetivo: "20-foot-radius", "10-foot pole".
    resultado = resultado.replace(
      new RegExp(`\\b(${NUMERO})-${u.replace('\\.?', '')}(?=[\\s-])`, 'gi'),
      (_t, n: string) => `${converter(n, unidade.fator)}-${unidade.adjetivo}`,
    );
    // Simples: "60 feet", "30 ft.", "50 ft/round", "10 pounds".
    resultado = resultado.replace(new RegExp(`\\b(${NUMERO})\\s*${u}(?!\\w|-\\w)`, 'gi'), (_t, n: string) => {
      return `${converter(n, unidade.fator)} ${unidade.simbolo}`;
    });
  }
  // "ft/round" e afins: a barra que sobrou depois da troca.
  return resultado.replace(/\b(m|km)\/round\b/g, '$1/rodada');
}
