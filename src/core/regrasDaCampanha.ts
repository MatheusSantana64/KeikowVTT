/**
 * As regras de cada campanha: começam como uma cópia das regras padrão e o mestre pode mudá-las.
 * Uma mudança só vale se as regras continuarem sem problemas, para nenhuma ficha quebrar
 * no meio da edição.
 */
import type { EstadoCompendio } from './compendio';
import type { Entrada } from './entradas';
import type { EstadoFichas } from './fichas';
import { lerFormula, normalizarNome, usoDaFormula } from './formulas';
import { criarLojaComHistorico, type LojaComHistorico } from './lojaHistorico';
import { soOMestre } from './permissoes';
import type { OpcoesRegistro } from './registro';
import { conferirRegras, nomesDasRegras, type Regras } from './regras';
import { REGRAS_PADRAO } from './regrasPadrao';

export type AcaoRegras =
  /** Troca as regras inteiras pela nova versão. Recusada se a nova versão tiver problemas. */
  | { readonly tipo: 'EditarRegras'; readonly regras: Regras }
  | { readonly tipo: 'CarregarRegras'; readonly regras: Regras };

const iguais = (a: Regras, b: Regras) => JSON.stringify(a) === JSON.stringify(b);

export function aplicarAcaoRegras(estado: Regras, acao: AcaoRegras): Regras {
  if (iguais(estado, acao.regras) || conferirRegras(acao.regras).length > 0) {
    return estado;
  }
  return acao.regras;
}

export type LojaRegras = LojaComHistorico<Regras, AcaoRegras>;

export function criarLojaRegras(inicial: Regras = REGRAS_PADRAO, opcoes: OpcoesRegistro = {}): LojaRegras {
  return criarLojaComHistorico(
    {
      inicial,
      aplicar: aplicarAcaoRegras,
      eventoDesfazer: 'DesfazerRegras',
      eventoRefazer: 'RefazerRegras',
      conferir: soOMestre('as regras'),
    },
    opcoes,
  );
}

/**
 * O nome interno de uma perícia ou valor novo, tirado do nome mostrado: "Sanidade" vira `sanidade`.
 * Nunca repete um nome já usado pelas regras.
 */
export function novoIdDeRegra(regras: Regras, nome: string): string {
  const base =
    normalizarNome(nome)
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^(?=\d)/, 'n_') || 'novo';
  const usados = new Set([...nomesDasRegras(regras), 'e', 'ou', 'ilimitado', 'valor', 'atributo', 'proficiencia', 'nivel_classe', 'nivel_espaco']);
  if (!usados.has(base)) {
    return base;
  }
  let n = 2;
  while (usados.has(`${base}_${n}`)) {
    n += 1;
  }
  return `${base}_${n}`;
}

/** Os nomes citados pelas fórmulas de uma entrada: efeitos, ações, usos e tabelas. */
function nomesCitados(valor: unknown, achados: Set<string>): void {
  if (typeof valor === 'string') {
    const lido = lerFormula(valor);
    if (lido.ok) {
      usoDaFormula(lido.formula).nomes.forEach((n) => achados.add(n));
    }
  } else if (Array.isArray(valor)) {
    valor.forEach((v) => nomesCitados(v, achados));
  } else if (typeof valor === 'object' && valor !== null) {
    Object.values(valor).forEach((v) => nomesCitados(v, achados));
  }
}

function citaONome(entrada: Entrada, id: string): boolean {
  const achados = new Set<string>();
  // Nome, descrição e etiquetas são texto livre: só os dados, efeitos e ações têm fórmulas.
  nomesCitados([entrada.dados, entrada.efeitos, entrada.acoes], achados);
  return achados.has(id);
}

/** Quantas entradas e fichas usam uma perícia ou valor, para avisar antes de apagá-lo. */
export function usosDoNome(id: string, compendio: EstadoCompendio, fichas: EstadoFichas) {
  const entradas = Object.values(compendio.entradas).filter((e) => citaONome(e, id)).length;
  const nasFichas = Object.values(fichas.fichas).filter(
    (f) => id in f.proficiencias || Object.values(f.entradas).some((e) => citaONome(e, id)),
  ).length;
  return { entradas, fichas: nasFichas };
}
