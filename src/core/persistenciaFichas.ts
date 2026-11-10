import { ATRIBUTOS, type Atributo } from './entradas';
import {
  MULTIPLICADORES_PROFICIENCIA,
  NIVEL_MAXIMO,
  TIPOS_FICHA,
  type EstadoFichas,
  type Ficha,
  type TipoFicha,
} from './fichas';
import { ehObjeto, exigir, type ResultadoDe } from './persistencia';
import { atualizarEntradas, comoResultado, lerEntradas, lerJson, VERSAO_COMPENDIO } from './persistenciaCompendio';

const VERSAO_FICHAS = 1;

type Dado = Record<string, unknown>;

function texto(d: Dado, campo: string, onde: string): string {
  const valor = d[campo];
  exigir(typeof valor === 'string', `${onde}: "${campo}" precisa ser um texto.`);
  return valor;
}

function inteiro(valor: unknown, onde: string, minimo: number, maximo = Infinity): number {
  exigir(
    typeof valor === 'number' && Number.isInteger(valor) && valor >= minimo && valor <= maximo,
    `${onde} tem um número inválido.`,
  );
  return valor as number;
}

function idOuNulo(d: Dado, campo: string, onde: string): string | null {
  return d[campo] === null ? null : texto(d, campo, onde);
}

/** Lê uma ficha, conferindo que cada classe, espécie e monstro citados estão entre as cópias. */
function lerFicha(valor: unknown, onde: string, versaoEntradas: number): Ficha {
  exigir(ehObjeto(valor), `${onde} não é válida.`);
  const tipo = valor.tipo;
  exigir(typeof tipo === 'string' && (TIPOS_FICHA as readonly string[]).includes(tipo), `${onde}: o tipo é desconhecido.`);
  const atributos = valor.atributos;
  exigir(ehObjeto(atributos), `${onde} está sem os atributos.`);
  const lidas = lerEntradas(atualizarEntradas(valor.entradas, versaoEntradas), `${onde}: as cópias`);
  const entradas = Object.fromEntries(lidas.map((e) => [e.id, e]));

  const confereCopia = (id: string | null, tipoEsperado: string, oQue: string) => {
    exigir(id === null || entradas[id]?.tipo === tipoEsperado, `${onde}: ${oQue} não está entre as cópias da ficha.`);
    return id;
  };

  exigir(Array.isArray(valor.classes), `${onde} está sem a lista de classes.`);
  const classes = valor.classes.map((c, i) => {
    exigir(ehObjeto(c), `${onde}: a classe nº ${i + 1} não é válida.`);
    return {
      entradaId: confereCopia(texto(c, 'entradaId', onde), 'classe', `a classe nº ${i + 1}`) as string,
      nivel: inteiro(c.nivel, `${onde}: a classe nº ${i + 1}`, 1, NIVEL_MAXIMO),
    };
  });
  exigir(
    classes.reduce((s, c) => s + c.nivel, 0) <= NIVEL_MAXIMO,
    `${onde}: a soma dos níveis passa de ${NIVEL_MAXIMO}.`,
  );

  const proficiencias = valor.proficiencias;
  exigir(ehObjeto(proficiencias), `${onde} está sem as proficiências.`);
  for (const multiplicador of Object.values(proficiencias)) {
    exigir(
      (MULTIPLICADORES_PROFICIENCIA as readonly unknown[]).includes(multiplicador),
      `${onde}: uma proficiência tem um valor inválido.`,
    );
  }

  exigir(Array.isArray(valor.pvPorNivel), `${onde} está sem os PV por nível.`);
  const pvPorNivel = valor.pvPorNivel.map((pv) => (pv === null ? null : inteiro(pv, `${onde}: os PV de um nível`, 0)));

  return {
    id: texto(valor, 'id', onde),
    tipo: tipo as TipoFicha,
    nome: texto(valor, 'nome', onde),
    donoId: texto(valor, 'donoId', onde),
    atributos: Object.fromEntries(
      ATRIBUTOS.map((a) => [a, inteiro(atributos[a], `${onde}: ${a.toUpperCase()}`, 1, 30)]),
    ) as Record<Atributo, number>,
    entradas,
    classes,
    especieId: confereCopia(idOuNulo(valor, 'especieId', onde), 'especie', 'a espécie'),
    antecedenteId: confereCopia(idOuNulo(valor, 'antecedenteId', onde), 'antecedente', 'o antecedente'),
    monstroId: confereCopia(idOuNulo(valor, 'monstroId', onde), 'monstro', 'o monstro'),
    proficiencias: proficiencias as Record<string, number>,
    pvPorNivel,
    pvAtuais: valor.pvAtuais === null ? null : inteiro(valor.pvAtuais, `${onde}: os PV atuais`, -1000),
    pvTemporarios: inteiro(valor.pvTemporarios, `${onde}: os PV temporários`, 0),
    notas: texto(valor, 'notas', onde),
  };
}

export function fichasParaObjeto(estado: EstadoFichas) {
  return {
    versao: VERSAO_FICHAS,
    // As cópias seguem o formato do compêndio; guardar a versão dele permite converter depois.
    versaoEntradas: VERSAO_COMPENDIO,
    fichas: Object.values(estado.fichas).map((ficha) => ({ ...ficha, entradas: Object.values(ficha.entradas) })),
  };
}

function lerEstado(dados: unknown, onde: string): EstadoFichas {
  exigir(ehObjeto(dados) && dados.versao === VERSAO_FICHAS, `${onde} usam um formato desconhecido.`);
  const versaoEntradas = dados.versaoEntradas;
  exigir(
    typeof versaoEntradas === 'number' && Number.isInteger(versaoEntradas) && versaoEntradas >= 1 && versaoEntradas <= VERSAO_COMPENDIO,
    `${onde} têm cópias de entradas num formato desconhecido.`,
  );
  exigir(Array.isArray(dados.fichas), `${onde} estão sem a lista de fichas.`);
  const fichas: Record<string, Ficha> = {};
  dados.fichas.forEach((item, i) => {
    const ficha = lerFicha(item, `A ficha nº ${i + 1}`, versaoEntradas);
    exigir(!(ficha.id in fichas), `A ficha "${ficha.id}" está repetida.`);
    fichas[ficha.id] = ficha;
  });
  return { fichas };
}

export function serializarFichas(estado: EstadoFichas): string {
  return JSON.stringify(fichasParaObjeto(estado));
}

export function desserializarFichas(textoSalvo: string): ResultadoDe<{ readonly estado: EstadoFichas }> {
  return comoResultado(() => ({ estado: lerEstado(lerJson(textoSalvo, 'As fichas'), 'As fichas') }));
}

/** As fichas dentro de um arquivo salvo. Arquivos sem fichas devolvem `estado: null`. */
export function lerFichasDoArquivo(textoSalvo: string): ResultadoDe<{ readonly estado: EstadoFichas | null }> {
  return comoResultado(() => {
    const dados = lerJson(textoSalvo, 'O arquivo');
    if (!ehObjeto(dados) || !('fichas' in dados)) {
      return { estado: null };
    }
    return { estado: lerEstado(dados.fichas, 'As fichas do arquivo') };
  });
}
