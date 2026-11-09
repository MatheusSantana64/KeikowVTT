import { lerIndicePacotes, lerPacote, type Pacote, type ResumoPacote } from '../core/pacotes';
import type { ResultadoDe } from '../core/persistencia';

/** Os pacotes de conteúdo ficam numa pasta própria, fora do código. */
const PASTA_PACOTES = `${import.meta.env.BASE_URL}pacotes/`;

async function baixarTexto(arquivo: string): Promise<ResultadoDe<{ readonly texto: string }>> {
  try {
    const resposta = await fetch(`${PASTA_PACOTES}${arquivo}`);
    if (!resposta.ok) {
      return { ok: false, erro: `não foi possível baixar ${arquivo} (HTTP ${resposta.status}).` };
    }
    return { ok: true, texto: await resposta.text() };
  } catch {
    return { ok: false, erro: `não foi possível baixar ${arquivo}.` };
  }
}

export async function carregarIndicePacotes(): Promise<ResultadoDe<{ readonly pacotes: readonly ResumoPacote[] }>> {
  const baixado = await baixarTexto('indice.json');
  return baixado.ok ? lerIndicePacotes(baixado.texto) : baixado;
}

export async function carregarPacote(resumo: ResumoPacote): Promise<ResultadoDe<{ readonly pacote: Pacote }>> {
  const baixado = await baixarTexto(resumo.arquivo);
  if (!baixado.ok) {
    return baixado;
  }
  const lido = lerPacote(baixado.texto);
  if (lido.ok && lido.pacote.id !== resumo.id) {
    return { ok: false, erro: `o arquivo ${resumo.arquivo} traz outro pacote.` };
  }
  return lido;
}
