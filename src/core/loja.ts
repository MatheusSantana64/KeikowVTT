import { aplicarAcao, criarMapaVazio, type AcaoMapa, type EstadoMapa } from './mapa';

type OuvinteMapa = (estado: EstadoMapa) => void;

export interface LojaMapa {
  obterEstado(): EstadoMapa;
  despachar(acao: AcaoMapa): void;
  /** Avisa o ouvinte a cada mudança e devolve a função que cancela o aviso. */
  assinar(ouvinte: OuvinteMapa): () => void;
}

/** Guarda o estado atual do mapa. Toda mudança passa por uma ação. */
export function criarLojaMapa(inicial: EstadoMapa = criarMapaVazio()): LojaMapa {
  let estado = inicial;
  const ouvintes = new Set<OuvinteMapa>();

  return {
    obterEstado: () => estado,
    despachar(acao) {
      const novo = aplicarAcao(estado, acao);
      if (novo === estado) {
        return;
      }
      estado = novo;
      ouvintes.forEach((ouvinte) => ouvinte(estado));
    },
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
  };
}
