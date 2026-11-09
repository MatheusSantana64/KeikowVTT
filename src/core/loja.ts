import { aplicarAcao, criarMapaVazio, type AcaoMapa, type EstadoMapa } from './mapa';

type OuvinteMapa = (estado: EstadoMapa) => void;

export interface LojaMapa {
  obterEstado(): EstadoMapa;
  /** Ações seguidas com o mesmo `grupo` contam como um único passo de desfazer. */
  despachar(acao: AcaoMapa, grupo?: string): void;
  /** Avisa o ouvinte a cada mudança e devolve a função que cancela o aviso. */
  assinar(ouvinte: OuvinteMapa): () => void;
  /** A partir daqui, todas as ações contam como um único passo de desfazer. */
  iniciarTraco(): void;
  terminarTraco(): void;
  desfazer(): void;
  refazer(): void;
  podeDesfazer(): boolean;
  podeRefazer(): boolean;
}

export const LIMITE_HISTORICO = 200;

/** Guarda o estado atual do mapa e o histórico. Toda mudança passa por uma ação. */
export function criarLojaMapa(inicial: EstadoMapa = criarMapaVazio()): LojaMapa {
  let estado = inicial;
  // Os estados nunca são alterados, então guardar cada um deles é barato.
  const passado: EstadoMapa[] = [];
  let futuro: EstadoMapa[] = [];
  let emTraco = false;
  let tracoJaRegistrado = false;
  let ultimoGrupo: string | undefined;
  const ouvintes = new Set<OuvinteMapa>();

  const mudarPara = (novo: EstadoMapa) => {
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
      const novo = aplicarAcao(estado, acao);
      if (novo === estado) {
        return;
      }
      registrarNoHistorico(grupo);
      mudarPara(novo);
    },
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    iniciarTraco() {
      emTraco = true;
      tracoJaRegistrado = false;
    },
    terminarTraco: encerrarTraco,
    desfazer() {
      encerrarTraco();
      const anterior = passado.pop();
      if (anterior) {
        futuro.push(estado);
        mudarPara(anterior);
      }
    },
    refazer() {
      encerrarTraco();
      const seguinte = futuro.pop();
      if (seguinte) {
        passado.push(estado);
        mudarPara(seguinte);
      }
    },
    podeDesfazer: () => passado.length > 0,
    podeRefazer: () => futuro.length > 0,
  };
}
