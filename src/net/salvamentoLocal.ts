import type { LojaGrupo } from '../core/grupo';
import type { LojaMapa } from '../core/loja';
import { desserializarMapa, serializarMapa, type ResultadoLeitura } from '../core/persistencia';
import type { ArmazenamentoLocal } from './armazenamentoLocal';

const CHAVE = 'keikow.mapa';
/** Última mudança, guardada às pressas quando a página fecha antes de terminar de gravar. */
const CHAVE_EMERGENCIA = 'keikow.mapa.emergencia';
const ESPERA_MS = 500;

/** Pequeno, mas imediato: serve para a migração e para salvar às pressas ao fechar a página. */
export type ArmazenamentoRapido = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

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
async function transferir(principal: ArmazenamentoLocal, texto: string): Promise<boolean> {
  try {
    await principal.gravar(CHAVE, texto);
    return (await principal.obter(CHAVE)) === texto;
  } catch {
    return false;
  }
}

/**
 * Lê o mapa guardado neste navegador, ou `null` se não houver nada.
 * Na primeira vez, traz para `principal` o mapa que estava no armazenamento antigo.
 */
export async function lerSalvamentoLocal(
  principal: ArmazenamentoLocal,
  rapido: ArmazenamentoRapido,
): Promise<ResultadoLeitura | null> {
  const emergencia = lerRapido(rapido, CHAVE_EMERGENCIA);
  if (emergencia !== null) {
    const resultado = desserializarMapa(emergencia);
    if (resultado.ok) {
      if (await transferir(principal, emergencia)) {
        removerRapido(rapido, CHAVE_EMERGENCIA);
      }
      return resultado;
    }
    removerRapido(rapido, CHAVE_EMERGENCIA);
  }

  let salvo: string | null = null;
  let falhou = false;
  try {
    salvo = await principal.obter(CHAVE);
  } catch {
    falhou = true;
  }
  if (salvo !== null) {
    return desserializarMapa(salvo);
  }

  const antigo = lerRapido(rapido, CHAVE);
  if (antigo !== null) {
    const resultado = desserializarMapa(antigo);
    if (resultado.ok && (await transferir(principal, antigo))) {
      removerRapido(rapido, CHAVE);
    }
    return resultado;
  }

  return falhou
    ? { ok: false, erro: 'O navegador não permitiu ler o salvamento automático.' }
    : null;
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
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let temMudancas = false;
  let gravando = false;

  const textoAtual = () => serializarMapa(loja.obterEstado(), lojaGrupo.obterEstado());

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
        await principal.gravar(CHAVE, textoAtual());
      }
      // A cópia às pressas ficou velha; se sobrasse, substituiria o mapa na próxima abertura.
      removerRapido(rapido, CHAVE_EMERGENCIA);
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
  const cancelarAssinaturaMapa = loja.assinar(agendarGravacao);
  const cancelarAssinaturaGrupo = lojaGrupo.assinar(agendarGravacao);

  // Uma gravação iniciada enquanto a página fecha pode não terminar. A cópia às pressas cobre isso.
  const aoFecharPagina = () => {
    if (temMudancas || gravando) {
      try {
        rapido.setItem(CHAVE_EMERGENCIA, textoAtual());
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
    cancelarAssinaturaMapa();
    cancelarAssinaturaGrupo();
    if (temJanela) {
      window.removeEventListener('pagehide', aoFecharPagina);
    }
  };
}
