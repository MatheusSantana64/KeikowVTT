/**
 * O registro das rolagens de dados da mesa. Por enquanto fica neste computador;
 * na fase online, vira o chat, com rolagens públicas ou secretas.
 */
import type { DadoRolado } from './formulas';
import { ehObjeto, exigir, lerVisibilidade, type ResultadoDe } from './persistencia';
import { comoResultado, lerJson } from './persistenciaCompendio';
import { ehMestre, paraJogadores, podeVer, SO_MESTRE, VISIVEL_A_TODOS, type Visibilidade } from './visibilidade';

const ID_DO_MESTRE = 'mestre';

export const LIMITE_ROLAGENS = 200;
const VERSAO_ROLAGENS = 1;

export interface RolagemRegistrada {
  readonly id: string;
  /** Milissegundos desde 1970, como Date.now(). */
  readonly momento: number;
  readonly autorId: string;
  /** A ficha que rolou, quando há uma. */
  readonly fichaId: string | null;
  /** Quem rolou, como aparece no registro: o nome da ficha. */
  readonly quem: string;
  /** O que foi rolado, como "Atletismo" ou "Longsword: dano". */
  readonly rotulo: string;
  /** A fórmula já com os números, como "1d20 + 6". */
  readonly formula: string;
  readonly dados: readonly DadoRolado[];
  readonly total: number;
  /** O d20 que contou mostrou 20 ou 1. */
  readonly natural: 20 | 1 | null;
  /** Rolagem secreta: só o mestre vê (e quem rolou, se foi um jogador). */
  readonly visibilidade: Visibilidade;
}

export type NovaRolagem = Omit<RolagemRegistrada, 'id' | 'momento' | 'natural'>;

/** O d20 que contou na rolagem, se ele mostrou 20 ou 1 (o crítico e a falha automática). */
export function naturalDaRolagem(dados: readonly DadoRolado[]): 20 | 1 | null {
  const d20 = dados.find((d) => d.faces === 20);
  if (!d20) {
    return null;
  }
  const valor = d20.valores.find((_, i) => d20.mantidos[i]);
  return valor === 20 ? 20 : valor === 1 ? 1 : null;
}

export interface LojaRolagens {
  /** Da mais nova para a mais antiga. */
  obterRolagens(): readonly RolagemRegistrada[];
  registrar(nova: NovaRolagem): RolagemRegistrada;
  substituir(rolagens: readonly RolagemRegistrada[]): void;
  limpar(): void;
  assinar(ouvinte: () => void): () => void;
}

export function criarLojaRolagens(
  inicial: readonly RolagemRegistrada[] = [],
  agora: () => number = Date.now,
  criarId: () => string = () => crypto.randomUUID(),
): LojaRolagens {
  let rolagens = inicial.slice(0, LIMITE_ROLAGENS);
  const ouvintes = new Set<() => void>();
  const avisar = () => ouvintes.forEach((o) => o());
  return {
    obterRolagens: () => rolagens,
    registrar(nova) {
      const registrada: RolagemRegistrada = { ...nova, id: criarId(), momento: agora(), natural: naturalDaRolagem(nova.dados) };
      rolagens = [registrada, ...rolagens].slice(0, LIMITE_ROLAGENS);
      avisar();
      return registrada;
    },
    substituir(novas) {
      rolagens = novas.slice(0, LIMITE_ROLAGENS);
      avisar();
    },
    limpar() {
      rolagens = [];
      avisar();
    },
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
  };
}

/** Quem pode ver a rolagem: a secreta do mestre é só dele; a secreta de um jogador, dele e do mestre. */
export function visibilidadeDaRolagem(secreta: boolean, autorId: string = ID_DO_MESTRE): Visibilidade {
  if (!secreta) {
    return VISIVEL_A_TODOS;
  }
  return ehMestre(autorId) ? SO_MESTRE : paraJogadores([autorId]);
}

/** As rolagens que um participante vê. */
export function rolagensVisiveis(rolagens: readonly RolagemRegistrada[], participanteId: string): readonly RolagemRegistrada[] {
  return ehMestre(participanteId) ? rolagens : rolagens.filter((r) => podeVer(r.visibilidade, participanteId));
}

export function serializarRolagens(rolagens: readonly RolagemRegistrada[]): string {
  return JSON.stringify({ versao: VERSAO_ROLAGENS, rolagens });
}

function lerDado(valor: unknown, onde: string): DadoRolado {
  exigir(ehObjeto(valor), `${onde} não é válido.`);
  const { texto, faces, valores, mantidos } = valor;
  exigir(
    typeof texto === 'string' &&
      typeof faces === 'number' &&
      Array.isArray(valores) &&
      valores.every((v) => typeof v === 'number') &&
      Array.isArray(mantidos) &&
      mantidos.length === valores.length &&
      mantidos.every((m) => typeof m === 'boolean'),
    `${onde} não é válido.`,
  );
  return { texto, faces, valores: valores as number[], mantidos: mantidos as boolean[] };
}

export function desserializarRolagens(texto: string): ResultadoDe<{ readonly rolagens: readonly RolagemRegistrada[] }> {
  return comoResultado(() => {
    const dados = lerJson(texto, 'O registro de rolagens');
    exigir(ehObjeto(dados) && dados.versao === VERSAO_ROLAGENS && Array.isArray(dados.rolagens), 'O registro de rolagens usa um formato desconhecido.');
    const rolagens = dados.rolagens.map((r, i): RolagemRegistrada => {
      const onde = `A rolagem nº ${i + 1}`;
      exigir(ehObjeto(r), `${onde} não é válida.`);
      const textos = ['id', 'autorId', 'quem', 'rotulo', 'formula'] as const;
      for (const campo of textos) {
        exigir(typeof r[campo] === 'string', `${onde}: "${campo}" precisa ser um texto.`);
      }
      exigir(typeof r.momento === 'number' && typeof r.total === 'number', `${onde} tem números inválidos.`);
      exigir(r.fichaId === null || typeof r.fichaId === 'string', `${onde}: a ficha não é válida.`);
      exigir(Array.isArray(r.dados), `${onde} está sem os dados.`);
      const lidos = r.dados.map((d, j) => lerDado(d, `${onde}, dado nº ${j + 1}`));
      return {
        id: r.id as string,
        momento: r.momento as number,
        autorId: r.autorId as string,
        fichaId: r.fichaId as string | null,
        quem: r.quem as string,
        rotulo: r.rotulo as string,
        formula: r.formula as string,
        dados: lidos,
        total: r.total as number,
        natural: naturalDaRolagem(lidos),
        visibilidade: lerVisibilidade(r.visibilidade, onde),
      };
    });
    return { rolagens };
  });
}
