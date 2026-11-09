import type { CoordHex } from './hex';
import { criarEmissor, type OpcoesRegistro, type TipoEvento } from './registro';

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
}

export function criarLojaComHistorico<Estado, Acao extends { readonly tipo: TipoEvento }>(
  definicao: DefinicaoLoja<Estado, Acao>,
  opcoes: OpcoesRegistro = {},
): LojaComHistorico<Estado, Acao> {
  const { aplicar, coordDaAcao, eventoDesfazer, eventoRefazer } = definicao;
  const emitir = criarEmissor(opcoes);
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
      if (novo === estado) {
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
      const anterior = passado.pop();
      if (anterior) {
        futuro.push(estado);
        mudarPara(anterior);
        emitir(eventoDesfazer, null, null);
      }
    },
    refazer() {
      encerrarTraco();
      const seguinte = futuro.pop();
      if (seguinte) {
        passado.push(estado);
        mudarPara(seguinte);
        emitir(eventoRefazer, null, null);
      }
    },
    podeDesfazer: () => passado.length > 0,
    podeRefazer: () => futuro.length > 0,
  };
}
