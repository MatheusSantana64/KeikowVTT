import type { CoordHex } from './hex';
import { criarEmissor, type OpcoesRegistro } from './registro';

export interface EstadoGrupo {
  /** Hex onde o grupo está, ou `null` enquanto o mestre não o posicionou. */
  readonly posicao: CoordHex | null;
}

export type AcaoGrupo = {
  readonly tipo: 'PosicionarGrupo';
  readonly coord: CoordHex | null;
};

export const GRUPO_SEM_POSICAO: EstadoGrupo = { posicao: null };

export function aplicarAcaoGrupo(estado: EstadoGrupo, acao: AcaoGrupo): EstadoGrupo {
  const { posicao } = estado;
  const mesmaPosicao =
    posicao?.q === acao.coord?.q && posicao?.r === acao.coord?.r;
  return mesmaPosicao ? estado : { posicao: acao.coord };
}

type OuvinteGrupo = (estado: EstadoGrupo) => void;

export interface LojaGrupo {
  obterEstado(): EstadoGrupo;
  despachar(acao: AcaoGrupo): void;
  assinar(ouvinte: OuvinteGrupo): () => void;
}

/** Fica separada da loja do mapa para que o Ctrl+Z do mestre nunca mova o grupo. */
export function criarLojaGrupo(
  inicial: EstadoGrupo = GRUPO_SEM_POSICAO,
  opcoes: OpcoesRegistro = {},
): LojaGrupo {
  let estado = inicial;
  const ouvintes = new Set<OuvinteGrupo>();
  const emitir = criarEmissor(opcoes);

  return {
    obterEstado: () => estado,
    despachar(acao) {
      const novo = aplicarAcaoGrupo(estado, acao);
      if (novo !== estado) {
        estado = novo;
        ouvintes.forEach((ouvinte) => ouvinte(estado));
        emitir(acao.tipo, acao.coord, null);
      }
    },
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
  };
}
