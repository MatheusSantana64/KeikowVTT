import type { LojaCampanha } from '../core/campanha';
import type { LojaGrupo } from '../core/grupo';
import type { LojaMapa } from '../core/loja';
import {
  desserializarMapa,
  serializarMapa,
  type ResultadoDe,
  type ResultadoLeitura,
} from '../core/persistencia';
import {
  desserializarCampanha,
  serializarCampanha,
  type ConteudoCampanha,
} from '../core/persistenciaCampanha';
import type { LojaRegistro } from '../core/registro';
import type { EstadoCompendio, LojaCompendio } from '../core/compendio';
import { desserializarCompendio, serializarCompendio } from '../core/persistenciaCompendio';
import type { EstadoFichas, LojaFichas } from '../core/fichas';
import { desserializarFichas, serializarFichas } from '../core/persistenciaFichas';
import type { ArmazenamentoLocal } from './armazenamentoLocal';

const ESPERA_MS = 500;

/** Pequeno, mas imediato: serve para a migração e para salvar às pressas ao fechar a página. */
export type ArmazenamentoRapido = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

interface Locais {
  readonly principal: ArmazenamentoLocal;
  readonly rapido: ArmazenamentoRapido;
}

interface DefinicaoDocumento<T> {
  readonly chave: string;
  /** Última mudança, guardada às pressas quando a página fecha antes de terminar de gravar. */
  readonly chaveEmergencia: string;
  /** Onde o documento ficava antes de existir o armazenamento principal. */
  readonly chaveAntiga?: string;
  readonly desserializar: (texto: string) => ResultadoDe<T>;
}

function lerRapido(rapido: ArmazenamentoRapido, chave: string): string | null {
  try {
    return rapido.getItem(chave);
  } catch {
    return null;
  }
}

function removerRapido(rapido: ArmazenamentoRapido, chave: string): void {
  try {
    rapido.removeItem(chave);
  } catch {
    // Sobrar uma cópia antiga não atrapalha.
  }
}

/** Grava e confere. Só depois disso a cópia de origem pode ser apagada. */
async function transferir(
  principal: ArmazenamentoLocal,
  chave: string,
  texto: string,
): Promise<boolean> {
  try {
    await principal.gravar(chave, texto);
    return (await principal.obter(chave)) === texto;
  } catch {
    return false;
  }
}

async function lerDocumento<T>(
  definicao: DefinicaoDocumento<T>,
  { principal, rapido }: Locais,
): Promise<ResultadoDe<T> | null> {
  const { chave, chaveEmergencia, chaveAntiga, desserializar } = definicao;

  const emergencia = lerRapido(rapido, chaveEmergencia);
  if (emergencia !== null) {
    const resultado = desserializar(emergencia);
    if (resultado.ok) {
      if (await transferir(principal, chave, emergencia)) {
        removerRapido(rapido, chaveEmergencia);
      }
      return resultado;
    }
    removerRapido(rapido, chaveEmergencia);
  }

  let salvo: string | null = null;
  let falhou = false;
  try {
    salvo = await principal.obter(chave);
  } catch {
    falhou = true;
  }
  if (salvo !== null) {
    return desserializar(salvo);
  }

  const antigo = chaveAntiga === undefined ? null : lerRapido(rapido, chaveAntiga);
  if (antigo !== null && chaveAntiga !== undefined) {
    const resultado = desserializar(antigo);
    if (resultado.ok && (await transferir(principal, chave, antigo))) {
      removerRapido(rapido, chaveAntiga);
    }
    return resultado;
  }

  return falhou
    ? { ok: false, erro: 'O navegador não permitiu ler o salvamento automático.' }
    : null;
}

type Assinar = (ouvinte: () => void) => () => void;

function manterDocumento(
  { chave, chaveEmergencia }: Pick<DefinicaoDocumento<unknown>, 'chave' | 'chaveEmergencia'>,
  textoAtual: () => string,
  assinaturas: readonly Assinar[],
  aoFalhar: () => void,
  { principal, rapido }: Locais,
): () => void {
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let temMudancas = false;
  let gravando = false;

  const gravarAgora = async () => {
    if (temporizador !== null) {
      clearTimeout(temporizador);
      temporizador = null;
    }
    if (gravando || !temMudancas) {
      return;
    }
    gravando = true;
    try {
      while (temMudancas) {
        temMudancas = false;
        await principal.gravar(chave, textoAtual());
      }
      // A cópia às pressas ficou velha; se sobrasse, substituiria os dados na próxima abertura.
      removerRapido(rapido, chaveEmergencia);
    } catch {
      temMudancas = true;
      aoFalhar();
    } finally {
      gravando = false;
    }
  };

  const agendarGravacao = () => {
    temMudancas = true;
    if (temporizador !== null) {
      clearTimeout(temporizador);
    }
    temporizador = setTimeout(() => void gravarAgora(), ESPERA_MS);
  };
  const cancelamentos = assinaturas.map((assinar) => assinar(agendarGravacao));

  // Uma gravação iniciada enquanto a página fecha pode não terminar. A cópia às pressas cobre isso.
  const aoFecharPagina = () => {
    if (temMudancas || gravando) {
      try {
        rapido.setItem(chaveEmergencia, textoAtual());
      } catch {
        // Sem espaço: resta a gravação normal abaixo.
      }
    }
    void gravarAgora();
  };

  const temJanela = typeof window !== 'undefined';
  if (temJanela) {
    window.addEventListener('pagehide', aoFecharPagina);
  }

  return () => {
    void gravarAgora();
    cancelamentos.forEach((cancelar) => cancelar());
    if (temJanela) {
      window.removeEventListener('pagehide', aoFecharPagina);
    }
  };
}

const DOCUMENTO_MAPA = {
  chave: 'keikow.mapa',
  chaveEmergencia: 'keikow.mapa.emergencia',
  chaveAntiga: 'keikow.mapa',
  desserializar: desserializarMapa,
};

const DOCUMENTO_CAMPANHA = {
  chave: 'keikow.campanha',
  chaveEmergencia: 'keikow.campanha.emergencia',
  desserializar: desserializarCampanha,
};

/**
 * Lê o mapa guardado neste navegador, ou `null` se não houver nada.
 * Na primeira vez, traz para `principal` o mapa que estava no armazenamento antigo.
 */
export function lerSalvamentoLocal(
  principal: ArmazenamentoLocal,
  rapido: ArmazenamentoRapido,
): Promise<ResultadoLeitura | null> {
  return lerDocumento(DOCUMENTO_MAPA, { principal, rapido });
}

/**
 * Salva o mapa no navegador pouco depois de cada mudança.
 * Devolve a função que encerra o salvamento, gravando o que estiver pendente.
 * `aoFalhar` avisa quando o navegador recusa guardar o mapa.
 */
export function manterSalvamentoLocal(
  loja: LojaMapa,
  lojaGrupo: LojaGrupo,
  aoFalhar: () => void,
  principal: ArmazenamentoLocal,
  rapido: ArmazenamentoRapido,
): () => void {
  return manterDocumento(
    DOCUMENTO_MAPA,
    () => serializarMapa(loja.obterEstado(), lojaGrupo.obterEstado()),
    [loja.assinar, lojaGrupo.assinar],
    aoFalhar,
    { principal, rapido },
  );
}

const DOCUMENTO_COMPENDIO = {
  chave: 'keikow.compendio',
  chaveEmergencia: 'keikow.compendio.emergencia',
  desserializar: desserializarCompendio,
};

/** Lê o compêndio guardado neste navegador, ou `null` se ainda não houver nada. */
export function lerCompendioLocal(
  principal: ArmazenamentoLocal,
  rapido: ArmazenamentoRapido,
): Promise<ResultadoDe<{ readonly estado: EstadoCompendio }> | null> {
  return lerDocumento(DOCUMENTO_COMPENDIO, { principal, rapido });
}

export function manterCompendioLocal(
  lojaCompendio: LojaCompendio,
  aoFalhar: () => void,
  principal: ArmazenamentoLocal,
  rapido: ArmazenamentoRapido,
): () => void {
  return manterDocumento(
    DOCUMENTO_COMPENDIO,
    () => serializarCompendio(lojaCompendio.obterEstado()),
    [lojaCompendio.assinar],
    aoFalhar,
    { principal, rapido },
  );
}

const DOCUMENTO_FICHAS = {
  chave: 'keikow.fichas',
  chaveEmergencia: 'keikow.fichas.emergencia',
  desserializar: desserializarFichas,
};

/** Lê as fichas guardadas neste navegador, ou `null` se ainda não houver nada. */
export function lerFichasLocal(
  principal: ArmazenamentoLocal,
  rapido: ArmazenamentoRapido,
): Promise<ResultadoDe<{ readonly estado: EstadoFichas }> | null> {
  return lerDocumento(DOCUMENTO_FICHAS, { principal, rapido });
}

export function manterFichasLocal(
  lojaFichas: LojaFichas,
  aoFalhar: () => void,
  principal: ArmazenamentoLocal,
  rapido: ArmazenamentoRapido,
): () => void {
  return manterDocumento(
    DOCUMENTO_FICHAS,
    () => serializarFichas(lojaFichas.obterEstado()),
    [lojaFichas.assinar],
    aoFalhar,
    { principal, rapido },
  );
}

/** Lê os participantes e o registro da campanha, ou `null` se ainda não houver nada guardado. */
export function lerCampanhaLocal(
  principal: ArmazenamentoLocal,
  rapido: ArmazenamentoRapido,
): Promise<ResultadoDe<ConteudoCampanha> | null> {
  return lerDocumento(DOCUMENTO_CAMPANHA, { principal, rapido });
}

export function manterCampanhaLocal(
  lojaCampanha: LojaCampanha,
  lojaRegistro: LojaRegistro,
  aoFalhar: () => void,
  principal: ArmazenamentoLocal,
  rapido: ArmazenamentoRapido,
): () => void {
  return manterDocumento(
    DOCUMENTO_CAMPANHA,
    () =>
      serializarCampanha({
        campanha: lojaCampanha.obterEstado(),
        registro: lojaRegistro.obterEntradas(),
      }),
    [lojaCampanha.assinar, lojaRegistro.assinar],
    aoFalhar,
    { principal, rapido },
  );
}
