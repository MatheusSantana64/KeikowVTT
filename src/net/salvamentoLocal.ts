import type { LojaGrupo } from '../core/grupo';
import type { LojaMapa } from '../core/loja';
import { desserializarMapa, serializarMapa, type ResultadoLeitura } from '../core/persistencia';

const CHAVE = 'keikow.mapa';
const ESPERA_MS = 500;

type Armazenamento = Pick<Storage, 'getItem' | 'setItem'>;

/** Devolve `null` quando ainda não há nada salvo neste navegador. */
export function lerSalvamentoLocal(
  armazenamento: Armazenamento = localStorage,
): ResultadoLeitura | null {
  let texto: string | null;
  try {
    texto = armazenamento.getItem(CHAVE);
  } catch {
    return { ok: false, erro: 'O navegador não permitiu ler o salvamento automático.' };
  }
  return texto === null ? null : desserializarMapa(texto);
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
  armazenamento: Armazenamento = localStorage,
): () => void {
  let temporizador: ReturnType<typeof setTimeout> | null = null;

  const gravarPendente = () => {
    if (temporizador === null) {
      return;
    }
    clearTimeout(temporizador);
    temporizador = null;
    try {
      armazenamento.setItem(CHAVE, serializarMapa(loja.obterEstado(), lojaGrupo.obterEstado()));
    } catch {
      aoFalhar();
    }
  };

  const agendarGravacao = () => {
    if (temporizador !== null) {
      clearTimeout(temporizador);
    }
    temporizador = setTimeout(gravarPendente, ESPERA_MS);
  };
  const cancelarAssinaturaMapa = loja.assinar(agendarGravacao);
  const cancelarAssinaturaGrupo = lojaGrupo.assinar(agendarGravacao);

  // Garante que a última mudança seja salva se a página fechar logo depois dela.
  const temJanela = typeof window !== 'undefined';
  if (temJanela) {
    window.addEventListener('pagehide', gravarPendente);
  }

  return () => {
    gravarPendente();
    cancelarAssinaturaMapa();
    cancelarAssinaturaGrupo();
    if (temJanela) {
      window.removeEventListener('pagehide', gravarPendente);
    }
  };
}
