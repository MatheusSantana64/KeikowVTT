/**
 * Fichas de personagem, NPC e monstro. As três usam o mesmo formato.
 *
 * A ficha guarda cópias das entradas do compêndio que usa (classe, espécie, antecedente,
 * habilidades, monstro): editar ou apagar a entrada no compêndio depois não muda a ficha.
 */
import { ID_MESTRE } from './campanha';
import type { EstadoCompendio } from './compendio';
import { ATRIBUTOS, NIVEIS_DA_TABELA, type Atributo, type Entrada, type EntradaDe } from './entradas';
import { criarLojaComHistorico, type LojaComHistorico } from './lojaHistorico';
import type { OpcoesRegistro } from './registro';

export const TIPOS_FICHA = ['personagem', 'npc', 'monstro'] as const;
export type TipoFicha = (typeof TIPOS_FICHA)[number];

/** Sem proficiência, metade, proficiente ou especialista. */
export const MULTIPLICADORES_PROFICIENCIA = [0, 0.5, 1, 2] as const;

export const NIVEL_MAXIMO = NIVEIS_DA_TABELA;

export interface ClasseNaFicha {
  /** Id da cópia da classe, em `entradas`. */
  readonly entradaId: string;
  readonly nivel: number;
}

export interface Ficha {
  readonly id: string;
  readonly tipo: TipoFicha;
  readonly nome: string;
  /** Participante da campanha que controla a ficha: o mestre ou um jogador. */
  readonly donoId: string;
  /** Os valores escolhidos para a ficha, antes dos aumentos da espécie e de outros efeitos. */
  readonly atributos: Readonly<Record<Atributo, number>>;
  /** Cópias das entradas do compêndio que a ficha usa, pelo id. */
  readonly entradas: Readonly<Record<string, Entrada>>;
  /** Na ordem em que foram pegas: a primeira dá o dado de vida cheio e as salvaguardas. */
  readonly classes: readonly ClasseNaFicha[];
  readonly especieId: string | null;
  readonly antecedenteId: string | null;
  /** Nas fichas de monstro, a cópia do monstro de onde vêm CA, PV e bônus. */
  readonly monstroId: string | null;
  /** Proficiências marcadas à mão, por perícia ou salvaguarda. Valem mais que as automáticas. */
  readonly proficiencias: Readonly<Record<string, number>>;
  /** PV ganhos em cada nível, na ordem dos níveis. `null` (ou faltando) usa a média. */
  readonly pvPorNivel: readonly (number | null)[];
  /** `null` quando a ficha está com os PV cheios. */
  readonly pvAtuais: number | null;
  readonly pvTemporarios: number;
  readonly notas: string;
}

export interface EstadoFichas {
  readonly fichas: Readonly<Record<string, Ficha>>;
}

export type AcaoFichas =
  | { readonly tipo: 'CriarFicha'; readonly ficha: Ficha }
  /** Troca a ficha inteira pela nova versão, mantendo id e tipo. */
  | { readonly tipo: 'EditarFicha'; readonly ficha: Ficha }
  | { readonly tipo: 'RemoverFicha'; readonly fichaId: string }
  | { readonly tipo: 'CarregarFichas'; readonly estado: EstadoFichas };

export function criarFichasVazias(): EstadoFichas {
  return { fichas: {} };
}

const ATRIBUTOS_INICIAIS: Readonly<Record<Atributo, number>> = {
  for: 10,
  des: 10,
  con: 10,
  int: 10,
  sab: 10,
  car: 10,
};

export function criarFicha(tipo: Exclude<TipoFicha, 'monstro'>, id: string, donoId: string = ID_MESTRE): Ficha {
  return {
    id,
    tipo,
    nome: '',
    donoId,
    atributos: { ...ATRIBUTOS_INICIAIS },
    entradas: {},
    classes: [],
    especieId: null,
    antecedenteId: null,
    monstroId: null,
    proficiencias: {},
    pvPorNivel: [],
    pvAtuais: null,
    pvTemporarios: 0,
    notas: '',
  };
}

/** Uma ficha de monstro, com cópia do monstro do compêndio. Fica com o mestre. */
export function fichaDeMonstro(monstro: EntradaDe<'monstro'>, id: string): Ficha {
  return {
    ...criarFicha('npc', id),
    tipo: 'monstro',
    nome: monstro.nome,
    atributos: { ...monstro.dados.atributos },
    entradas: { [monstro.id]: monstro },
    monstroId: monstro.id,
  };
}

export function entradaDaFicha<T extends Entrada['tipo']>(
  ficha: Ficha,
  id: string | null,
  tipo: T,
): Extract<Entrada, { tipo: T }> | null {
  const entrada = id ? ficha.entradas[id] : undefined;
  return entrada && entrada.tipo === tipo ? (entrada as Extract<Entrada, { tipo: T }>) : null;
}

export function nivelTotal(ficha: Ficha): number {
  return ficha.classes.reduce((soma, c) => soma + c.nivel, 0);
}

/** Habilidades que uma entrada cita: as da classe, os traços da espécie, as do antecedente. */
function referenciasDe(entrada: Entrada): string[] {
  switch (entrada.tipo) {
    case 'classe':
      return entrada.dados.habilidades.map((h) => h.entradaId);
    case 'especie':
      return [...entrada.dados.tracos];
    case 'antecedente':
      return [...entrada.dados.habilidades];
    default:
      return [];
  }
}

/** A entrada do compêndio e as habilidades que ela cita, prontas para copiar na ficha. */
function copiasDe(compendio: EstadoCompendio, entrada: Entrada): Record<string, Entrada> {
  const copias: Record<string, Entrada> = { [entrada.id]: entrada };
  for (const id of referenciasDe(entrada)) {
    const citada = compendio.entradas[id];
    if (citada) {
      copias[id] = citada;
    }
  }
  return copias;
}

/**
 * Tira as cópias que nenhuma parte da ficha usa mais, como as habilidades de uma classe removida.
 * Só mexe nos tipos que chegam pela classe, espécie, antecedente ou monstro.
 */
function semCopiasSoltas(ficha: Ficha): Ficha {
  const raizes = [
    ...ficha.classes.map((c) => c.entradaId),
    ficha.especieId,
    ficha.antecedenteId,
    ficha.monstroId,
  ].filter((id): id is string => id !== null);
  const usadas = new Set(raizes);
  for (const id of raizes) {
    const entrada = ficha.entradas[id];
    if (entrada) {
      referenciasDe(entrada).forEach((r) => usadas.add(r));
    }
  }
  const tiposControlados = new Set(['classe', 'especie', 'antecedente', 'habilidade', 'monstro']);
  const entradas = Object.fromEntries(
    Object.entries(ficha.entradas).filter(([id, e]) => usadas.has(id) || !tiposControlados.has(e.tipo)),
  );
  return { ...ficha, entradas };
}

/** Acrescenta uma classe do compêndio no nível 1, se ainda houver nível livre. */
export function comClasse(ficha: Ficha, compendio: EstadoCompendio, classeId: string): Ficha {
  const classe = compendio.entradas[classeId];
  if (
    !classe ||
    classe.tipo !== 'classe' ||
    ficha.classes.some((c) => c.entradaId === classeId) ||
    nivelTotal(ficha) >= NIVEL_MAXIMO
  ) {
    return ficha;
  }
  return {
    ...ficha,
    entradas: { ...ficha.entradas, ...copiasDe(compendio, classe) },
    classes: [...ficha.classes, { entradaId: classeId, nivel: 1 }],
  };
}

/** Muda o nível de uma classe, sem deixar o total passar do máximo. */
export function comNivel(ficha: Ficha, classeId: string, nivel: number): Ficha {
  const outros = ficha.classes.filter((c) => c.entradaId !== classeId).reduce((s, c) => s + c.nivel, 0);
  const permitido = Math.max(1, Math.min(Math.round(nivel), NIVEL_MAXIMO - outros));
  return {
    ...ficha,
    classes: ficha.classes.map((c) => (c.entradaId === classeId ? { ...c, nivel: permitido } : c)),
  };
}

export function semClasse(ficha: Ficha, classeId: string): Ficha {
  return semCopiasSoltas({ ...ficha, classes: ficha.classes.filter((c) => c.entradaId !== classeId) });
}

/** Troca a espécie ou o antecedente por um do compêndio, ou tira (`null`). */
export function comOrigem(
  ficha: Ficha,
  compendio: EstadoCompendio,
  campo: 'especieId' | 'antecedenteId',
  entradaId: string | null,
): Ficha {
  const tipo = campo === 'especieId' ? 'especie' : 'antecedente';
  const entrada = entradaId ? compendio.entradas[entradaId] : null;
  if (entradaId && (!entrada || entrada.tipo !== tipo)) {
    return ficha;
  }
  const sem = { ...ficha, [campo]: null };
  if (!entrada) {
    return semCopiasSoltas(sem);
  }
  return semCopiasSoltas({ ...sem, entradas: { ...sem.entradas, ...copiasDe(compendio, entrada) }, [campo]: entrada.id });
}

/** O dado de vida de cada nível, na ordem: a primeira classe primeiro. */
export function dadosDeVida(ficha: Ficha): number[] {
  const dados: number[] = [];
  for (const c of ficha.classes) {
    const classe = entradaDaFicha(ficha, c.entradaId, 'classe');
    if (classe) {
      dados.push(...Array<number>(c.nivel).fill(classe.dados.dadoVida));
    }
  }
  return dados;
}

/**
 * Os PV que os dados de vida dão em cada nível: o dado cheio no 1º, e depois a média
 * (metade do dado + 1), a menos que a ficha tenha o valor rolado daquele nível.
 */
export function pvPorNivel(ficha: Ficha): { readonly dado: number; readonly valor: number; readonly rolado: boolean }[] {
  return dadosDeVida(ficha).map((dado, i) => {
    const rolado = ficha.pvPorNivel[i];
    if (rolado !== null && rolado !== undefined) {
      return { dado, valor: rolado, rolado: true };
    }
    return { dado, valor: i === 0 ? dado : Math.floor(dado / 2) + 1, rolado: false };
  });
}

function editarFicha(estado: EstadoFichas, nova: Ficha): EstadoFichas {
  const atual = estado.fichas[nova.id];
  if (!atual || atual.tipo !== nova.tipo || JSON.stringify(atual) === JSON.stringify(nova)) {
    return estado;
  }
  return { fichas: { ...estado.fichas, [nova.id]: nova } };
}

export function aplicarAcaoFichas(estado: EstadoFichas, acao: AcaoFichas): EstadoFichas {
  switch (acao.tipo) {
    case 'CriarFicha':
      return acao.ficha.id in estado.fichas
        ? estado
        : { fichas: { ...estado.fichas, [acao.ficha.id]: acao.ficha } };
    case 'EditarFicha':
      return editarFicha(estado, acao.ficha);
    case 'RemoverFicha': {
      if (!(acao.fichaId in estado.fichas)) {
        return estado;
      }
      const fichas = { ...estado.fichas };
      delete fichas[acao.fichaId];
      return { fichas };
    }
    case 'CarregarFichas':
      return acao.estado;
  }
}

/** As fichas em ordem alfabética, sem diferenciar maiúsculas. */
export function fichasEmOrdem(estado: EstadoFichas): Ficha[] {
  return Object.values(estado.fichas).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
}

export type LojaFichas = LojaComHistorico<EstadoFichas, AcaoFichas>;

export function criarLojaFichas(inicial: EstadoFichas = criarFichasVazias(), opcoes: OpcoesRegistro = {}): LojaFichas {
  return criarLojaComHistorico(
    { inicial, aplicar: aplicarAcaoFichas, eventoDesfazer: 'DesfazerFichas', eventoRefazer: 'RefazerFichas' },
    opcoes,
  );
}

export function atributosValidos(valores: Readonly<Record<string, number>>): boolean {
  return ATRIBUTOS.every((a) => Number.isInteger(valores[a]) && valores[a] >= 1 && valores[a] <= 30);
}
