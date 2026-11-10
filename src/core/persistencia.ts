import { APARENCIA_PADRAO, type AparenciaOculta, type FundoOculto } from './aparencia';
import { GRUPO_SEM_POSICAO, type EstadoGrupo } from './grupo';
import { chaveHex, type ChaveHex } from './hex';
import type { Manifesto } from './manifesto';
import { INFORMACAO_VAZIA, type Decoracao, type EstadoMapa, type Hex, type Nota } from './mapa';
import { paraJogadores, SO_MESTRE, VISIVEL_A_TODOS, type Visibilidade } from './visibilidade';

/** Aumente ao mudar o formato do arquivo, para poder converter mapas antigos. */
const VERSAO_ARQUIVO = 3;

interface ConteudoArquivo {
  readonly estado: EstadoMapa;
  readonly grupo: EstadoGrupo;
}

/** O que foi lido de um texto salvo, ou o motivo de não ter sido possível ler. */
export type ResultadoDe<T> =
  | ({ readonly ok: true } & T)
  | { readonly ok: false; readonly erro: string };

export type ResultadoLeitura = ResultadoDe<ConteudoArquivo>;

export class ErroDeFormato extends Error {}

export function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export function exigir(condicao: boolean, mensagem: string): asserts condicao {
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

/** Uma visibilidade desconhecida é recusada: um segredo nunca pode virar público por engano. */
export function lerVisibilidade(dado: unknown, onde: string): Visibilidade {
  exigir(ehObjeto(dado), `${onde} está sem visibilidade.`);
  if (dado.tipo === 'jogadores') {
    const { ids } = dado;
    exigir(
      Array.isArray(ids) && ids.every((id) => typeof id === 'string' && id !== ''),
      `${onde} tem uma lista de jogadores inválida.`,
    );
    return paraJogadores(ids as string[]);
  }
  exigir(dado.tipo === 'todos' || dado.tipo === 'mestre', `${onde} tem uma visibilidade inválida.`);
  return dado.tipo === 'todos' ? VISIVEL_A_TODOS : SO_MESTRE;
}

function lerNota(dado: unknown, onde: string): Nota {
  exigir(ehObjeto(dado), `${onde} não é uma nota válida.`);
  const { id, texto, visibilidade } = dado;
  exigir(typeof id === 'string' && id !== '', `${onde} está sem id.`);
  exigir(typeof texto === 'string', `${onde} está sem texto.`);
  return { id, texto, visibilidade: lerVisibilidade(visibilidade, onde) };
}

function lerHex(dado: unknown, posicao: number): Hex {
  const onde = `O hex nº ${posicao + 1}`;
  exigir(ehObjeto(dado), `${onde} não é válido.`);
  const { q, r, terreno, decoracoes, nome, descricao, notas, revelado } = dado;
  exigir(Number.isInteger(q) && Number.isInteger(r), `${onde} tem coordenadas inválidas.`);
  exigir(typeof terreno === 'string' && terreno !== '', `${onde} está sem terreno.`);
  exigir(Array.isArray(decoracoes), `${onde} está sem a lista de decorações.`);
  exigir(typeof nome === 'string', `${onde} está sem nome.`);
  exigir(typeof descricao === 'string', `${onde} está sem descrição.`);
  exigir(Array.isArray(notas), `${onde} está sem a lista de notas.`);
  exigir(typeof revelado === 'boolean', `${onde} não diz se está revelado.`);
  return {
    coord: { q: q as number, r: r as number },
    terreno,
    decoracoes: decoracoes.map((d, i) => lerDecoracao(d, `A decoração nº ${i + 1} de ${onde}`)),
    nome,
    descricao,
    notas: notas.map((n, i) => lerNota(n, `A nota nº ${i + 1} de ${onde}`)),
    revelado,
  };
}

function lerFundoOculto(dado: unknown): FundoOculto {
  const erro = 'A aparência dos hexes não vistos é inválida.';
  exigir(ehObjeto(dado), erro);
  if (dado.tipo === 'escuro' && typeof dado.grid === 'boolean') {
    return { tipo: 'escuro', grid: dado.grid };
  }
  if (dado.tipo === 'neblina' && (dado.variante === 'clara' || dado.variante === 'escura')) {
    return { tipo: 'neblina', variante: dado.variante };
  }
  if (dado.tipo === 'tile' && typeof dado.assetId === 'string' && dado.assetId !== '') {
    return { tipo: 'tile', assetId: dado.assetId };
  }
  throw new ErroDeFormato(erro);
}

function lerAparencia(dado: unknown): AparenciaOculta {
  exigir(ehObjeto(dado), 'O arquivo não tem a aparência dos hexes não vistos.');
  exigir(typeof dado.bordasSuaves === 'boolean', 'A aparência não diz se as bordas são suaves.');
  return { fundo: lerFundoOculto(dado.fundo), bordasSuaves: dado.bordasSuaves };
}

function lerGrupo(dado: unknown): EstadoGrupo {
  if (dado === null) {
    return GRUPO_SEM_POSICAO;
  }
  exigir(
    ehObjeto(dado) && Number.isInteger(dado.q) && Number.isInteger(dado.r),
    'A posição do grupo é inválida.',
  );
  return { posicao: { q: dado.q as number, r: dado.r as number } };
}

/** A versão 1 não tinha nome, descrição nem notas; as versões 1 e 2 não tinham revelação. */
function converterHexAntigo(hex: unknown, versao: number): unknown {
  if (!ehObjeto(hex)) {
    return hex;
  }
  return { ...(versao === 1 ? INFORMACAO_VAZIA : {}), revelado: false, ...hex };
}

function lerArquivo(texto: string): ConteudoArquivo {
  let dados: unknown;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new ErroDeFormato('O arquivo não é um JSON válido.');
  }
  exigir(ehObjeto(dados) && 'versao' in dados, 'O arquivo não é um mapa do KeikowVTT.');
  exigir(
    dados.versao === 1 || dados.versao === 2 || dados.versao === VERSAO_ARQUIVO,
    `Este mapa usa a versão ${String(dados.versao)} do formato, que não é suportada.`,
  );
  exigir(Array.isArray(dados.hexes), 'O arquivo não tem a lista de hexes.');
  const versao = dados.versao;
  const ehAtual = versao === VERSAO_ARQUIVO;
  const listaDeHexes: unknown[] = ehAtual
    ? dados.hexes
    : dados.hexes.map((hex: unknown) => converterHexAntigo(hex, versao));
  const aparenciaOculta = ehAtual ? lerAparencia(dados.aparenciaOculta) : APARENCIA_PADRAO;
  const grupo = ehAtual ? lerGrupo(dados.posicaoGrupo) : GRUPO_SEM_POSICAO;

  const hexes: Record<ChaveHex, Hex> = {};
  const idsDeDecoracao = new Set<string>();
  const idsDeNota = new Set<string>();

  listaDeHexes.forEach((dado, posicao) => {
    const hex = lerHex(dado, posicao);
    const chave = chaveHex(hex.coord);
    exigir(!(chave in hexes), `O hex (${chave}) aparece mais de uma vez.`);
    for (const decoracao of hex.decoracoes) {
      exigir(!idsDeDecoracao.has(decoracao.id), `A decoração "${decoracao.id}" está repetida.`);
      idsDeDecoracao.add(decoracao.id);
    }
    for (const nota of hex.notas) {
      exigir(!idsDeNota.has(nota.id), `A nota "${nota.id}" está repetida.`);
      idsDeNota.add(nota.id);
    }
    hexes[chave] = hex;
  });

  return { estado: { hexes, aparenciaOculta }, grupo };
}

export function mapaParaObjeto(estado: EstadoMapa, grupo: EstadoGrupo) {
  const hexes = Object.values(estado.hexes).map(
    ({ coord, terreno, decoracoes, nome, descricao, notas, revelado }) => ({
      q: coord.q,
      r: coord.r,
      terreno,
      decoracoes,
      nome,
      descricao,
      notas,
      revelado,
    }),
  );
  return {
    versao: VERSAO_ARQUIVO,
    aparenciaOculta: estado.aparenciaOculta,
    posicaoGrupo: grupo.posicao,
    hexes,
  };
}

export function serializarMapa(estado: EstadoMapa, grupo: EstadoGrupo): string {
  return JSON.stringify(mapaParaObjeto(estado, grupo), null, 2);
}

/** Lê um mapa salvo. Nunca lança erro: um arquivo inválido devolve o motivo. */
export function desserializarMapa(texto: string): ResultadoLeitura {
  try {
    return { ok: true, ...lerArquivo(texto) };
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
  const { fundo } = estado.aparenciaOculta;
  if (fundo.tipo === 'tile' && !conhecidos.has(fundo.assetId)) {
    desconhecidos.add(fundo.assetId);
  }
  for (const hex of Object.values(estado.hexes)) {
    for (const assetId of [hex.terreno, ...hex.decoracoes.map((d) => d.assetId)]) {
      if (!conhecidos.has(assetId)) {
        desconhecidos.add(assetId);
      }
    }
  }
  return [...desconhecidos];
}
