import type { CoordHex } from './hex';
import type { Permissao } from './permissoes';
import { autorDe, criarEmissor, type OpcoesRegistro, type TipoEvento } from './registro';

/** Guarda um estado e seu histórico. Toda mudança passa por uma ação. */
export interface LojaComHistorico<Estado, Acao> {
  obterEstado(): Estado;
  /** Ações seguidas com o mesmo `grupo` contam como um único passo de desfazer. */
  despachar(acao: Acao, grupo?: string): void;
  /** Avisa o ouvinte a cada mudança e devolve a função que cancela o aviso. */
  assinar(ouvinte: (estado: Estado) => void): () => void;
  /** A partir daqui, todas as ações contam como um único passo de desfazer. */
  iniciarTraco(): void;
  terminarTraco(): void;
  desfazer(): void;
  refazer(): void;
  podeDesfazer(): boolean;
  podeRefazer(): boolean;
}

export const LIMITE_HISTORICO = 200;

export interface DefinicaoLoja<Estado, Acao extends { readonly tipo: TipoEvento }> {
  readonly inicial: Estado;
  /** Precisa devolver o mesmo objeto quando a ação não muda nada. */
  readonly aplicar: (estado: Estado, acao: Acao) => Estado;
  /** O hex envolvido, para o registro. */
  readonly coordDaAcao?: (acao: Acao) => CoordHex | null;
  /** Como desfazer e refazer aparecem no registro. */
  readonly eventoDesfazer: TipoEvento;
  readonly eventoRefazer: TipoEvento;
  /**
   * Se quem está agindo pode passar de um estado ao outro. Vale também para desfazer e refazer:
   * um jogador não desfaz o que só o mestre poderia fazer.
   */
  readonly conferir?: (antes: Estado, depois: Estado, autorId: string) => Permissao;
}

export function criarLojaComHistorico<Estado, Acao extends { readonly tipo: TipoEvento }>(
  definicao: DefinicaoLoja<Estado, Acao>,
  opcoes: OpcoesRegistro = {},
): LojaComHistorico<Estado, Acao> {
  const { aplicar, coordDaAcao, eventoDesfazer, eventoRefazer, conferir } = definicao;
  const emitir = criarEmissor(opcoes);
  /** Devolve se a mudança pode acontecer; se não pode, avisa o motivo. */
  const permitido = (antes: Estado, depois: Estado, avisar: boolean) => {
    const permissao = conferir?.(antes, depois, autorDe(opcoes));
    if (permissao && !permissao.ok) {
      if (avisar) {
        opcoes.aoRecusar?.(permissao.motivo);
      }
      return false;
    }
    return true;
  };
  let numeroDoTraco = 0;
  let estado = definicao.inicial;
  // Os estados nunca são alterados, então guardar cada um deles é barato.
  const passado: Estado[] = [];
  let futuro: Estado[] = [];
  let emTraco = false;
  let tracoJaRegistrado = false;
  let ultimoGrupo: string | undefined;
  const ouvintes = new Set<(estado: Estado) => void>();

  const mudarPara = (novo: Estado) => {
    estado = novo;
    ouvintes.forEach((ouvinte) => ouvinte(estado));
  };

  const registrarNoHistorico = (grupo?: string) => {
    const mesmoTraco = emTraco && tracoJaRegistrado;
    const mesmoGrupo = grupo !== undefined && grupo === ultimoGrupo;
    ultimoGrupo = grupo;
    if (mesmoTraco || mesmoGrupo) {
      return;
    }
    tracoJaRegistrado = emTraco;
    passado.push(estado);
    if (passado.length > LIMITE_HISTORICO) {
      passado.shift();
    }
    futuro = [];
  };

  const encerrarTraco = () => {
    emTraco = false;
    tracoJaRegistrado = false;
    ultimoGrupo = undefined;
  };

  return {
    obterEstado: () => estado,
    despachar(acao, grupo) {
      const novo = aplicar(estado, acao);
      if (novo === estado || !permitido(estado, novo, true)) {
        return;
      }
      registrarNoHistorico(grupo);
      mudarPara(novo);
      emitir(
        acao.tipo,
        coordDaAcao?.(acao) ?? null,
        emTraco ? `traco:${numeroDoTraco}` : (grupo ?? null),
      );
    },
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    iniciarTraco() {
      emTraco = true;
      tracoJaRegistrado = false;
      numeroDoTraco += 1;
    },
    terminarTraco: encerrarTraco,
    desfazer() {
      encerrarTraco();
      const anterior = passado.at(-1);
      if (anterior && permitido(estado, anterior, true)) {
        passado.pop();
        futuro.push(estado);
        mudarPara(anterior);
        emitir(eventoDesfazer, null, null);
      }
    },
    refazer() {
      encerrarTraco();
      const seguinte = futuro.at(-1);
      if (seguinte && permitido(estado, seguinte, true)) {
        futuro.pop();
        passado.push(estado);
        mudarPara(seguinte);
        emitir(eventoRefazer, null, null);
      }
    },
    // Conferem a permissão também, para os botões ficarem desativados quando não se pode.
    podeDesfazer: () => passado.length > 0 && permitido(estado, passado[passado.length - 1], false),
    podeRefazer: () => futuro.length > 0 && permitido(estado, futuro[futuro.length - 1], false),
  };
}
