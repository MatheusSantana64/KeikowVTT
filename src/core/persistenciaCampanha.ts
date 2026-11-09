import type { EstadoCampanha, Participante } from './campanha';
import { ID_MESTRE } from './campanha';
import type { EstadoGrupo } from './grupo';
import type { CoordHex } from './hex';
import type { EstadoMapa } from './mapa';
import {
  ehObjeto,
  ErroDeFormato,
  exigir,
  lerVisibilidade,
  mapaParaObjeto,
  type ResultadoDe,
} from './persistencia';
import type { EntradaRegistro, TipoEvento } from './registro';
import type { EstadoCompendio } from './compendio';
import { compendioParaObjeto } from './persistenciaCompendio';

const VERSAO_CAMPANHA = 1;

export interface ConteudoCampanha {
  readonly campanha: EstadoCampanha;
  readonly registro: readonly EntradaRegistro[];
}

function lerParticipante(dado: unknown, posicao: number): Participante {
  const onde = `O participante nº ${posicao + 1}`;
  exigir(ehObjeto(dado), `${onde} não é válido.`);
  const { id, nome, papel } = dado;
  exigir(typeof id === 'string' && id !== '', `${onde} está sem id.`);
  exigir(typeof nome === 'string', `${onde} está sem nome.`);
  exigir(papel === 'mestre' || papel === 'jogador', `${onde} tem um papel inválido.`);
  return { id, nome, papel };
}

function lerCoordOpcional(dado: unknown, onde: string): CoordHex | null {
  if (dado === null) {
    return null;
  }
  exigir(
    ehObjeto(dado) && Number.isInteger(dado.q) && Number.isInteger(dado.r),
    `${onde} tem coordenadas inválidas.`,
  );
  return { q: dado.q as number, r: dado.r as number };
}

function lerEntrada(dado: unknown, posicao: number): EntradaRegistro {
  const onde = `A linha nº ${posicao + 1} do registro`;
  exigir(ehObjeto(dado), `${onde} não é válida.`);
  const { id, momento, autorId, tipo, coord, quantidade, visibilidade } = dado;
  exigir(Number.isInteger(id), `${onde} está sem número.`);
  exigir(Number.isFinite(momento), `${onde} está sem horário.`);
  exigir(typeof autorId === 'string' && autorId !== '', `${onde} está sem autor.`);
  exigir(typeof tipo === 'string' && tipo !== '', `${onde} está sem tipo.`);
  exigir(Number.isInteger(quantidade) && (quantidade as number) > 0, `${onde} tem quantidade inválida.`);
  return {
    id: id as number,
    momento: momento as number,
    autorId,
    tipo: tipo as TipoEvento,
    coord: lerCoordOpcional(coord, onde),
    quantidade: quantidade as number,
    visibilidade: lerVisibilidade(visibilidade, onde),
  };
}

function lerConteudo(dado: unknown): ConteudoCampanha {
  exigir(ehObjeto(dado), 'Os dados da campanha não são válidos.');
  const { nome, participantes, registro } = dado;
  exigir(typeof nome === 'string', 'A campanha está sem nome.');
  exigir(Array.isArray(participantes), 'A campanha está sem a lista de participantes.');
  exigir(Array.isArray(registro), 'A campanha está sem o registro.');

  const lista = participantes.map(lerParticipante);
  const ids = new Set(lista.map((p) => p.id));
  exigir(ids.size === lista.length, 'Há participantes repetidos na campanha.');
  const mestres = lista.filter((p) => p.papel === 'mestre');
  exigir(
    mestres.length === 1 && mestres[0].id === ID_MESTRE,
    'A campanha precisa ter exatamente um mestre.',
  );

  return { campanha: { nome, participantes: lista }, registro: registro.map(lerEntrada) };
}

function campanhaParaObjeto({ campanha, registro }: ConteudoCampanha) {
  return { nome: campanha.nome, participantes: campanha.participantes, registro };
}

function comoResultado<T>(ler: () => T): ResultadoDe<T> {
  try {
    return { ok: true, ...ler() };
  } catch (erro) {
    if (erro instanceof ErroDeFormato) {
      return { ok: false, erro: erro.message };
    }
    throw erro;
  }
}

function lerJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    throw new ErroDeFormato('O arquivo não é um JSON válido.');
  }
}

/** Formato do salvamento automático da campanha, separado do mapa. */
export function serializarCampanha(conteudo: ConteudoCampanha): string {
  return JSON.stringify({ versao: VERSAO_CAMPANHA, ...campanhaParaObjeto(conteudo) });
}

export function desserializarCampanha(texto: string): ResultadoDe<ConteudoCampanha> {
  return comoResultado(() => {
    const dados = lerJson(texto);
    exigir(
      ehObjeto(dados) && dados.versao === VERSAO_CAMPANHA,
      'Os dados da campanha usam um formato desconhecido.',
    );
    return lerConteudo(dados);
  });
}

/** O arquivo do botão Salvar: o mapa, com os dados da campanha e o compêndio junto. */
export function serializarArquivoCompleto(
  estado: EstadoMapa,
  grupo: EstadoGrupo,
  conteudo: ConteudoCampanha,
  compendio?: EstadoCompendio,
): string {
  return JSON.stringify(
    {
      ...mapaParaObjeto(estado, grupo),
      campanha: campanhaParaObjeto(conteudo),
      ...(compendio ? { compendio: compendioParaObjeto(compendio) } : {}),
    },
    null,
    2,
  );
}

/** A campanha dentro de um arquivo salvo. Arquivos antigos, só de mapa, devolvem `conteudo: null`. */
export function lerCampanhaDoArquivo(
  texto: string,
): ResultadoDe<{ readonly conteudo: ConteudoCampanha | null }> {
  return comoResultado(() => {
    const dados = lerJson(texto);
    if (!ehObjeto(dados) || !('campanha' in dados)) {
      return { conteudo: null };
    }
    return { conteudo: lerConteudo(dados.campanha) };
  });
}
