import { chaveHex, type ChaveHex } from './hex';
import type { Manifesto } from './manifesto';
import { INFORMACAO_VAZIA, type Decoracao, type EstadoMapa, type Hex } from './mapa';

/** Aumente ao mudar o formato do arquivo, para poder converter mapas antigos. */
const VERSAO_ARQUIVO = 1;

export type ResultadoLeitura =
  | { readonly ok: true; readonly estado: EstadoMapa }
  | { readonly ok: false; readonly erro: string };

class ErroDeFormato extends Error {}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function exigir(condicao: boolean, mensagem: string): asserts condicao {
  if (!condicao) {
    throw new ErroDeFormato(mensagem);
  }
}

function lerDecoracao(dado: unknown, onde: string): Decoracao {
  exigir(ehObjeto(dado), `${onde} não é uma decoração válida.`);
  const { id, assetId, deslocamento } = dado;
  exigir(typeof id === 'string' && id !== '', `${onde} está sem id.`);
  exigir(typeof assetId === 'string' && assetId !== '', `${onde} está sem imagem.`);
  exigir(ehObjeto(deslocamento), `${onde} está sem posição.`);
  const { x, y } = deslocamento;
  exigir(Number.isFinite(x) && Number.isFinite(y), `${onde} tem uma posição inválida.`);
  return { id, assetId, deslocamento: { x: x as number, y: y as number } };
}

function lerHex(dado: unknown, posicao: number): Hex {
  const onde = `O hex nº ${posicao + 1}`;
  exigir(ehObjeto(dado), `${onde} não é válido.`);
  const { q, r, terreno, decoracoes } = dado;
  exigir(Number.isInteger(q) && Number.isInteger(r), `${onde} tem coordenadas inválidas.`);
  exigir(typeof terreno === 'string' && terreno !== '', `${onde} está sem terreno.`);
  exigir(Array.isArray(decoracoes), `${onde} está sem a lista de decorações.`);
  return {
    ...INFORMACAO_VAZIA,
    coord: { q: q as number, r: r as number },
    terreno,
    decoracoes: decoracoes.map((d, i) => lerDecoracao(d, `A decoração nº ${i + 1} de ${onde}`)),
  };
}

function lerArquivo(texto: string): EstadoMapa {
  let dados: unknown;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new ErroDeFormato('O arquivo não é um JSON válido.');
  }
  exigir(ehObjeto(dados) && 'versao' in dados, 'O arquivo não é um mapa do KeikowVTT.');
  exigir(
    dados.versao === VERSAO_ARQUIVO,
    `Este mapa usa a versão ${String(dados.versao)} do formato, que não é suportada.`,
  );
  exigir(Array.isArray(dados.hexes), 'O arquivo não tem a lista de hexes.');

  const hexes: Record<ChaveHex, Hex> = {};
  const idsDeDecoracao = new Set<string>();

  dados.hexes.forEach((dado: unknown, posicao: number) => {
    const hex = lerHex(dado, posicao);
    const chave = chaveHex(hex.coord);
    exigir(!(chave in hexes), `O hex (${chave}) aparece mais de uma vez.`);
    for (const decoracao of hex.decoracoes) {
      exigir(!idsDeDecoracao.has(decoracao.id), `A decoração "${decoracao.id}" está repetida.`);
      idsDeDecoracao.add(decoracao.id);
    }
    hexes[chave] = hex;
  });

  return { hexes };
}

export function serializarMapa(estado: EstadoMapa): string {
  const hexes = Object.values(estado.hexes).map(({ coord, terreno, decoracoes }) => ({
    q: coord.q,
    r: coord.r,
    terreno,
    decoracoes,
  }));
  return JSON.stringify({ versao: VERSAO_ARQUIVO, hexes }, null, 2);
}

/** Lê um mapa salvo. Nunca lança erro: um arquivo inválido devolve o motivo. */
export function desserializarMapa(texto: string): ResultadoLeitura {
  try {
    return { ok: true, estado: lerArquivo(texto) };
  } catch (erro) {
    if (erro instanceof ErroDeFormato) {
      return { ok: false, erro: erro.message };
    }
    throw erro;
  }
}

/** Imagens usadas pelo mapa que não existem no manifesto (por exemplo, arquivos renomeados). */
export function assetsDesconhecidos(estado: EstadoMapa, manifesto: Manifesto): string[] {
  const conhecidos = new Set(manifesto.assets.map((asset) => asset.id));
  const desconhecidos = new Set<string>();
  for (const hex of Object.values(estado.hexes)) {
    for (const assetId of [hex.terreno, ...hex.decoracoes.map((d) => d.assetId)]) {
      if (!conhecidos.has(assetId)) {
        desconhecidos.add(assetId);
      }
    }
  }
  return [...desconhecidos];
}
