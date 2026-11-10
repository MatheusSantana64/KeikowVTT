/**
 * A linguagem das fórmulas da ficha, como `10 + mod(DES)` ou `2d6 + mod(FOR)`.
 *
 * O texto é lido por um interpretador próprio e nunca executado como código.
 * Há limites de tamanho e de dados, para que nenhuma fórmula trave o programa.
 *
 * - Números: `3`, `1.5` (o ponto separa decimais; a vírgula separa argumentos).
 * - Contas: `+ - * /`, parênteses e sinal negativo.
 * - Comparações: `>= <= > < = !=`, que valem 1 (sim) ou 0 (não), e as palavras `e` e `ou`.
 * - Nomes: `DES`, `nivel`, `prof`… sem diferenciar maiúsculas nem acentos (`Nível` = `nivel`).
 * - Funções: `min`, `max`, `piso`, `teto`, `arredondar`, `se(condição, sim, não)`,
 *   `tabela(coluna)` e as que o contexto oferecer, como `mod(DES)`.
 * - Dados: `1d8`, `d20`, `(nivel)d6`, `2d20kh1` (fica com o maior) e `2d20kl1` (com o menor).
 * - `ilimitado` vale infinito, como as fúrias do bárbaro no nível 20.
 */

export const LIMITE_TEXTO = 500;
const LIMITE_PROFUNDIDADE = 40;
/** Dados num único grupo, como o 100 de `100d6`. */
export const LIMITE_DADOS_GRUPO = 100;
/** Dados somando todos os grupos de uma rolagem. */
export const LIMITE_DADOS_ROLAGEM = 200;
export const LIMITE_FACES = 1000;
/** Uma célula de tabela pode citar outra coluna, mas não em cadeia sem fim. */
const LIMITE_TABELAS_ANINHADAS = 5;

export class ErroDeFormula extends Error {
  /** Posição no texto onde está o problema, quando se sabe. */
  readonly posicao: number | null;

  constructor(mensagem: string, posicao: number | null = null) {
    super(mensagem);
    this.posicao = posicao;
  }
}

// ---------- Árvore ----------

type Comparador = '>=' | '<=' | '>' | '<' | '=' | '!=';
type OperadorBinario = '+' | '-' | '*' | '/' | Comparador | 'e' | 'ou';

interface Posicao {
  readonly inicio: number;
  readonly fim: number;
}

/** A fórmula já lida, pronta para ser calculada. */
export type Arvore =
  | ({ readonly tipo: 'numero'; readonly valor: number } & Posicao)
  | ({ readonly tipo: 'nome'; readonly nome: string } & Posicao)
  | ({ readonly tipo: 'negativo'; readonly valor: Arvore } & Posicao)
  | ({
      readonly tipo: 'binaria';
      readonly op: OperadorBinario;
      readonly esquerda: Arvore;
      readonly direita: Arvore;
    } & Posicao)
  | ({ readonly tipo: 'chamada'; readonly funcao: string; readonly argumentos: readonly Arvore[] } & Posicao)
  | ({
      readonly tipo: 'dados';
      readonly quantidade: Arvore;
      readonly faces: Arvore;
      readonly manter: { readonly tipo: 'kh' | 'kl'; readonly quantidade: Arvore } | null;
    } & Posicao);

/** O texto original junto da árvore: dele saem os rótulos das explicações. */
export interface FormulaLida {
  readonly texto: string;
  readonly arvore: Arvore;
}

export type ResultadoFormula<T> =
  | ({ readonly ok: true } & T)
  | { readonly ok: false; readonly erro: string; readonly posicao: number | null };

// ---------- Leitura do texto ----------

type Operador = '+' | '-' | '*' | '/' | '(' | ')' | ',' | Comparador | 'd' | 'kh' | 'kl';

type Token =
  | ({ readonly tipo: 'numero'; readonly valor: number } & Posicao)
  | ({ readonly tipo: 'nome'; readonly nome: string } & Posicao)
  | ({ readonly tipo: 'operador'; readonly op: Operador } & Posicao)
  | ({ readonly tipo: 'fim' } & Posicao);

const ESPACO = /\s+/y;
const NUMERO = /\d+(?:\.\d+)?/y;
const NOME = /[\p{L}_][\p{L}\p{N}_]*/uy;
/** O "d" dos dados só vale antes de um número ou de um parêntese: `dano` continua sendo um nome. */
const DADO = /[dD](?=[\d(])/y;
const MANTER = /[kK][hHlL](?=[\d(])/y;
const OPERADORES: readonly (readonly [string, Operador])[] = [
  ['>=', '>='],
  ['<=', '<='],
  ['!=', '!='],
  ['==', '='],
  ['+', '+'],
  ['-', '-'],
  ['*', '*'],
  ['/', '/'],
  ['(', '('],
  [')', ')'],
  [',', ','],
  ['>', '>'],
  ['<', '<'],
  ['=', '='],
];

const COMPARADORES: ReadonlySet<string> = new Set(['>=', '<=', '>', '<', '=', '!=']);
const PALAVRAS_RESERVADAS: ReadonlySet<string> = new Set(['e', 'ou']);

/** Nomes sem diferença de maiúsculas e acentos: `Nível`, `NIVEL` e `nivel` são o mesmo. */
export function normalizarNome(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function casar(regra: RegExp, texto: string, posicao: number): string | null {
  regra.lastIndex = posicao;
  return regra.exec(texto)?.[0] ?? null;
}

function separar(texto: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const depoisDeValor = () => {
    const anterior = tokens[tokens.length - 1];
    return anterior !== undefined && (anterior.tipo === 'numero' || (anterior.tipo === 'operador' && anterior.op === ')'));
  };

  while (i < texto.length) {
    const espaco = casar(ESPACO, texto, i);
    if (espaco) {
      i += espaco.length;
      continue;
    }
    const numero = casar(NUMERO, texto, i);
    if (numero) {
      tokens.push({ tipo: 'numero', valor: Number(numero), inicio: i, fim: i + numero.length });
      i += numero.length;
      continue;
    }
    const manter = depoisDeValor() ? casar(MANTER, texto, i) : null;
    if (manter) {
      const op = manter.toLowerCase() as 'kh' | 'kl';
      tokens.push({ tipo: 'operador', op, inicio: i, fim: i + 2 });
      i += 2;
      continue;
    }
    if (casar(DADO, texto, i)) {
      tokens.push({ tipo: 'operador', op: 'd', inicio: i, fim: i + 1 });
      i += 1;
      continue;
    }
    const nome = casar(NOME, texto, i);
    if (nome) {
      tokens.push({ tipo: 'nome', nome: normalizarNome(nome), inicio: i, fim: i + nome.length });
      i += nome.length;
      continue;
    }
    const operador = OPERADORES.find(([simbolo]) => texto.startsWith(simbolo, i));
    if (!operador) {
      throw new ErroDeFormula(`O caractere "${texto[i]}" não faz parte das fórmulas.`, i);
    }
    tokens.push({ tipo: 'operador', op: operador[1], inicio: i, fim: i + operador[0].length });
    i += operador[0].length;
  }
  tokens.push({ tipo: 'fim', inicio: texto.length, fim: texto.length });
  return tokens;
}

/** Funções da própria linguagem, com quantos argumentos aceitam. */
const FUNCOES_DA_LINGUAGEM: Readonly<Record<string, { readonly minimo: number; readonly maximo: number }>> = {
  se: { minimo: 3, maximo: 3 },
  min: { minimo: 1, maximo: 20 },
  max: { minimo: 1, maximo: 20 },
  piso: { minimo: 1, maximo: 1 },
  teto: { minimo: 1, maximo: 1 },
  arredondar: { minimo: 1, maximo: 1 },
  tabela: { minimo: 1, maximo: 1 },
};

export function ehFuncaoDaLinguagem(nome: string): boolean {
  return nome in FUNCOES_DA_LINGUAGEM;
}

function temDados(no: Arvore): boolean {
  switch (no.tipo) {
    case 'dados':
      return true;
    case 'negativo':
      return temDados(no.valor);
    case 'binaria':
      return temDados(no.esquerda) || temDados(no.direita);
    case 'chamada':
      return no.argumentos.some(temDados);
    default:
      return false;
  }
}

function montarArvore(texto: string, tokens: readonly Token[]): Arvore {
  let pos = 0;
  let profundidade = 0;
  const atual = () => tokens[pos];
  const ehOp = (op: Operador) => {
    const t = atual();
    return t.tipo === 'operador' && t.op === op;
  };
  const ehPalavra = (palavra: string) => {
    const t = atual();
    return t.tipo === 'nome' && t.nome === palavra;
  };
  const trecho = (t: Token) => texto.slice(t.inicio, t.fim);
  const fechar = (mensagem: string, abertura: number) => {
    const t = atual();
    if (!(t.tipo === 'operador' && t.op === ')')) {
      throw new ErroDeFormula(mensagem, t.tipo === 'fim' ? abertura : t.inicio);
    }
    pos++;
    return t;
  };
  const binaria = (op: OperadorBinario, esquerda: Arvore, direita: Arvore): Arvore => ({
    tipo: 'binaria',
    op,
    esquerda,
    direita,
    inicio: esquerda.inicio,
    fim: direita.fim,
  });

  function expressao(): Arvore {
    profundidade++;
    if (profundidade > LIMITE_PROFUNDIDADE) {
      throw new ErroDeFormula('A fórmula tem parênteses ou funções demais, uns dentro dos outros.', atual().inicio);
    }
    try {
      return ou();
    } finally {
      profundidade--;
    }
  }

  function ou(): Arvore {
    let esquerda = e();
    while (ehPalavra('ou')) {
      pos++;
      esquerda = binaria('ou', esquerda, e());
    }
    return esquerda;
  }

  function e(): Arvore {
    let esquerda = comparacao();
    while (ehPalavra('e')) {
      pos++;
      esquerda = binaria('e', esquerda, comparacao());
    }
    return esquerda;
  }

  function comparacao(): Arvore {
    const esquerda = soma();
    const t = atual();
    if (t.tipo !== 'operador' || !COMPARADORES.has(t.op)) {
      return esquerda;
    }
    pos++;
    const no = binaria(t.op as Comparador, esquerda, soma());
    const seguinte = atual();
    if (seguinte.tipo === 'operador' && COMPARADORES.has(seguinte.op)) {
      throw new ErroDeFormula('Para juntar duas comparações, use "e" ou "ou", como em "nivel >= 5 e FOR >= 13".', seguinte.inicio);
    }
    return no;
  }

  function soma(): Arvore {
    let esquerda = produto();
    while (ehOp('+') || ehOp('-')) {
      const op = (atual() as { op: '+' | '-' }).op;
      pos++;
      esquerda = binaria(op, esquerda, produto());
    }
    return esquerda;
  }

  function produto(): Arvore {
    let esquerda = unario();
    while (ehOp('*') || ehOp('/')) {
      const op = (atual() as { op: '*' | '/' }).op;
      pos++;
      esquerda = binaria(op, esquerda, unario());
    }
    return esquerda;
  }

  function unario(): Arvore {
    if (ehOp('-')) {
      const sinal = atual();
      pos++;
      const valor = unario();
      return { tipo: 'negativo', valor, inicio: sinal.inicio, fim: valor.fim };
    }
    if (ehOp('+')) {
      pos++;
      return unario();
    }
    return dados();
  }

  function semDadosDentro(no: Arvore): Arvore {
    if (temDados(no)) {
      throw new ErroDeFormula('Não dá para rolar dados dentro da quantidade ou das faces de outros dados.', no.inicio);
    }
    return no;
  }

  function dados(): Arvore {
    let quantidade: Arvore;
    if (ehOp('d')) {
      // "d20" sozinho é um dado só.
      const t = atual();
      quantidade = { tipo: 'numero', valor: 1, inicio: t.inicio, fim: t.inicio };
    } else {
      quantidade = primario();
      if (!ehOp('d')) {
        return quantidade;
      }
    }
    pos++;
    const faces = semDadosDentro(primario());
    let manter: { tipo: 'kh' | 'kl'; quantidade: Arvore } | null = null;
    if (ehOp('kh') || ehOp('kl')) {
      const tipo = (atual() as { op: 'kh' | 'kl' }).op;
      pos++;
      manter = { tipo, quantidade: semDadosDentro(primario()) };
    }
    return {
      tipo: 'dados',
      quantidade: semDadosDentro(quantidade),
      faces,
      manter,
      inicio: quantidade.inicio,
      fim: (manter?.quantidade ?? faces).fim,
    };
  }

  function chamada(t: Extract<Token, { tipo: 'nome' }>): Arvore {
    const abertura = atual();
    pos++;
    const argumentos: Arvore[] = [];
    if (!ehOp(')')) {
      argumentos.push(expressao());
      while (ehOp(',')) {
        pos++;
        argumentos.push(expressao());
      }
    }
    const fim = fechar(`Faltou fechar o parêntese de "${trecho(t)}(".`, abertura.inicio);
    const regra = FUNCOES_DA_LINGUAGEM[t.nome];
    if (regra && (argumentos.length < regra.minimo || argumentos.length > regra.maximo)) {
      const esperado =
        regra.minimo === regra.maximo
          ? `${regra.minimo} ${regra.minimo === 1 ? 'valor' : 'valores'}`
          : `de ${regra.minimo} a ${regra.maximo} valores`;
      throw new ErroDeFormula(`"${trecho(t)}" precisa de ${esperado} entre os parênteses.`, t.inicio);
    }
    if (t.nome === 'tabela' && argumentos[0]?.tipo !== 'nome') {
      throw new ErroDeFormula('Dentro de "tabela(...)" vai o nome de uma coluna, como tabela(furias).', argumentos[0]?.inicio ?? t.inicio);
    }
    return { tipo: 'chamada', funcao: t.nome, argumentos, inicio: t.inicio, fim: fim.fim };
  }

  function primario(): Arvore {
    const t = atual();
    if (t.tipo === 'numero') {
      pos++;
      return { tipo: 'numero', valor: t.valor, inicio: t.inicio, fim: t.fim };
    }
    if (t.tipo === 'nome') {
      if (PALAVRAS_RESERVADAS.has(t.nome)) {
        throw new ErroDeFormula(`"${trecho(t)}" só pode aparecer entre duas condições.`, t.inicio);
      }
      pos++;
      if (ehOp('(')) {
        return chamada(t);
      }
      return { tipo: 'nome', nome: t.nome, inicio: t.inicio, fim: t.fim };
    }
    if (t.tipo === 'operador' && t.op === '(') {
      pos++;
      const dentro = expressao();
      const fim = fechar('Faltou fechar um parêntese.', t.inicio);
      return { ...dentro, inicio: t.inicio, fim: fim.fim };
    }
    if (t.tipo === 'fim') {
      throw new ErroDeFormula('A fórmula terminou antes do esperado.', t.inicio);
    }
    throw new ErroDeFormula(`Esperava um número, um nome ou "(" antes de "${trecho(t)}".`, t.inicio);
  }

  if (atual().tipo === 'fim') {
    throw new ErroDeFormula('A fórmula está vazia.', 0);
  }
  const arvore = expressao();
  const sobra = atual();
  if (sobra.tipo !== 'fim') {
    throw new ErroDeFormula(`Não entendi a fórmula a partir de "${texto.slice(sobra.inicio)}".`, sobra.inicio);
  }
  return arvore;
}

function comoResultado<T>(fazer: () => T): ResultadoFormula<T> {
  try {
    return { ok: true, ...fazer() };
  } catch (erro) {
    if (erro instanceof ErroDeFormula) {
      return { ok: false, erro: erro.message, posicao: erro.posicao };
    }
    throw erro;
  }
}

export function lerFormula(texto: string): ResultadoFormula<{ readonly formula: FormulaLida }> {
  return comoResultado(() => {
    if (texto.length > LIMITE_TEXTO) {
      throw new ErroDeFormula(`A fórmula passa de ${LIMITE_TEXTO} caracteres.`, LIMITE_TEXTO);
    }
    return { formula: { texto, arvore: montarArvore(texto, separar(texto)) } };
  });
}

/** O que a fórmula usa: serve para conferir nomes antes de calcular. */
export interface UsoDaFormula {
  /** Nomes citados, já normalizados, como `des` e `nivel`. Não inclui as colunas de `tabela(...)`. */
  readonly nomes: ReadonlySet<string>;
  /** Funções que não são da linguagem, como `mod`. */
  readonly funcoes: ReadonlySet<string>;
  /** Colunas citadas em `tabela(...)`. */
  readonly colunas: ReadonlySet<string>;
  readonly temDados: boolean;
}

export function usoDaFormula(formula: FormulaLida): UsoDaFormula {
  const nomes = new Set<string>();
  const funcoes = new Set<string>();
  const colunas = new Set<string>();
  const visitar = (no: Arvore): void => {
    switch (no.tipo) {
      case 'nome':
        if (no.nome !== 'ilimitado') {
          nomes.add(no.nome);
        }
        return;
      case 'negativo':
        return visitar(no.valor);
      case 'binaria':
        visitar(no.esquerda);
        return visitar(no.direita);
      case 'dados':
        visitar(no.quantidade);
        visitar(no.faces);
        if (no.manter) {
          visitar(no.manter.quantidade);
        }
        return;
      case 'chamada':
        if (no.funcao === 'tabela') {
          colunas.add((no.argumentos[0] as { nome: string }).nome);
          return;
        }
        if (!ehFuncaoDaLinguagem(no.funcao)) {
          funcoes.add(no.funcao);
        }
        no.argumentos.forEach(visitar);
        return;
      default:
        return;
    }
  };
  visitar(formula.arvore);
  return { nomes, funcoes, colunas, temDados: temDados(formula.arvore) };
}

// ---------- Cálculo ----------

/** De onde a fórmula tira os valores que ela cita. */
export interface ContextoFormula {
  /** O valor de um nome já normalizado, como `des` ou `nivel`. `undefined` quando o nome não existe. */
  valor(nome: string): number | undefined;
  /** Funções que não são da linguagem, como `mod`. `undefined` quando a função não existe. */
  funcao?(nome: string, argumentos: readonly number[]): number | undefined;
  /** A célula de uma coluna da tabela da classe, no nível atual. */
  tabela?(coluna: string): FormulaLida | undefined;
}

/** Um grupo de dados rolados, como os dois d20 de uma vantagem. */
export interface DadoRolado {
  /** Como `2d20kh1`. */
  readonly texto: string;
  readonly faces: number;
  readonly valores: readonly number[];
  /** Quais dados contam na soma (num `kh1`, só o maior). */
  readonly mantidos: readonly boolean[];
}

interface Ambiente {
  readonly contexto: ContextoFormula;
  readonly texto: string;
  /** `null` quando a fórmula não pode rolar dados. */
  readonly rolarDado: ((faces: number) => number) | null;
  readonly rolagem: { rolados: DadoRolado[]; quantidade: number; tabelas: number };
}

function inteiroEntre(valor: number, minimo: number, maximo: number, oQue: string, posicao: number): number {
  if (!Number.isInteger(valor) || valor < minimo || valor > maximo) {
    throw new ErroDeFormula(`${oQue} precisa ser um número inteiro de ${minimo} a ${maximo} (deu ${formatarNumero(valor)}).`, posicao);
  }
  return valor;
}

function verificado(valor: number, posicao: number): number {
  if (Number.isNaN(valor)) {
    throw new ErroDeFormula('A conta não deu um número (por exemplo, infinito menos infinito).', posicao);
  }
  return valor;
}

/** Quais dados ficam: os `quantos` maiores (kh) ou menores (kl). Em empate, o primeiro rolado. */
function escolherMantidos(valores: readonly number[], tipo: 'kh' | 'kl', quantos: number): boolean[] {
  const ordem = valores
    .map((valor, indice) => ({ valor, indice }))
    .sort((a, b) => (tipo === 'kh' ? b.valor - a.valor : a.valor - b.valor) || a.indice - b.indice);
  const mantidos = valores.map(() => false);
  for (const { indice } of ordem.slice(0, quantos)) {
    mantidos[indice] = true;
  }
  return mantidos;
}

function avaliar(no: Arvore, amb: Ambiente): number {
  switch (no.tipo) {
    case 'numero':
      return no.valor;
    case 'nome': {
      if (no.nome === 'ilimitado') {
        return Infinity;
      }
      const valor = amb.contexto.valor(no.nome);
      if (valor === undefined) {
        throw new ErroDeFormula(`Nome desconhecido: "${amb.texto.slice(no.inicio, no.fim)}".`, no.inicio);
      }
      return valor;
    }
    case 'negativo':
      return -avaliar(no.valor, amb);
    case 'binaria':
      return verificado(avaliarBinaria(no, amb), no.inicio);
    case 'chamada':
      return verificado(chamar(no, amb), no.inicio);
    case 'dados':
      return rolarGrupo(no, amb);
  }
}

function avaliarBinaria(no: Extract<Arvore, { tipo: 'binaria' }>, amb: Ambiente): number {
  // "e" e "ou" só olham o segundo lado quando precisam, como o "se".
  if (no.op === 'e') {
    return avaliar(no.esquerda, amb) !== 0 && avaliar(no.direita, amb) !== 0 ? 1 : 0;
  }
  if (no.op === 'ou') {
    return avaliar(no.esquerda, amb) !== 0 || avaliar(no.direita, amb) !== 0 ? 1 : 0;
  }
  const a = avaliar(no.esquerda, amb);
  const b = avaliar(no.direita, amb);
  switch (no.op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      if (b === 0) {
        throw new ErroDeFormula('Divisão por zero.', no.direita.inicio);
      }
      return a / b;
    case '>=':
      return a >= b ? 1 : 0;
    case '<=':
      return a <= b ? 1 : 0;
    case '>':
      return a > b ? 1 : 0;
    case '<':
      return a < b ? 1 : 0;
    case '=':
      return a === b ? 1 : 0;
    case '!=':
      return a !== b ? 1 : 0;
  }
}

function chamar(no: Extract<Arvore, { tipo: 'chamada' }>, amb: Ambiente): number {
  const args = no.argumentos;
  switch (no.funcao) {
    case 'se':
      return avaliar(args[0], amb) !== 0 ? avaliar(args[1], amb) : avaliar(args[2], amb);
    case 'min':
      return Math.min(...args.map((a) => avaliar(a, amb)));
    case 'max':
      return Math.max(...args.map((a) => avaliar(a, amb)));
    case 'piso':
      return Math.floor(avaliar(args[0], amb));
    case 'teto':
      return Math.ceil(avaliar(args[0], amb));
    case 'arredondar':
      return Math.round(avaliar(args[0], amb));
    case 'tabela':
      return avaliarTabela(no, amb);
    default: {
      const valores = args.map((a) => avaliar(a, amb));
      const resultado = amb.contexto.funcao?.(no.funcao, valores);
      if (resultado === undefined) {
        throw new ErroDeFormula(`Função desconhecida: "${amb.texto.slice(no.inicio, no.fim).split('(')[0]}".`, no.inicio);
      }
      return resultado;
    }
  }
}

function avaliarTabela(no: Extract<Arvore, { tipo: 'chamada' }>, amb: Ambiente): number {
  const coluna = (no.argumentos[0] as { nome: string }).nome;
  if (!amb.contexto.tabela) {
    throw new ErroDeFormula('"tabela(...)" só funciona em fórmulas de uma classe, como os usos de uma habilidade dela.', no.inicio);
  }
  const celula = amb.contexto.tabela(coluna);
  if (!celula) {
    throw new ErroDeFormula(`A tabela da classe não tem a coluna "${coluna}".`, no.argumentos[0].inicio);
  }
  if (amb.rolagem.tabelas >= LIMITE_TABELAS_ANINHADAS) {
    throw new ErroDeFormula('A tabela cita outras colunas em cadeia demais (uma coluna pode estar citando a si mesma).', no.inicio);
  }
  amb.rolagem.tabelas++;
  try {
    return avaliar(celula.arvore, { ...amb, texto: celula.texto });
  } catch (erro) {
    if (erro instanceof ErroDeFormula) {
      throw new ErroDeFormula(`Na coluna "${coluna}" da tabela: ${erro.message}`, no.inicio);
    }
    throw erro;
  } finally {
    amb.rolagem.tabelas--;
  }
}

function rolarGrupo(no: Extract<Arvore, { tipo: 'dados' }>, amb: Ambiente): number {
  if (!amb.rolarDado) {
    throw new ErroDeFormula('Esta fórmula rola dados, então só vale numa rolagem.', no.inicio);
  }
  const quantidade = inteiroEntre(avaliar(no.quantidade, amb), 0, LIMITE_DADOS_GRUPO, 'A quantidade de dados', no.inicio);
  const faces = inteiroEntre(avaliar(no.faces, amb), 1, LIMITE_FACES, 'O número de faces', no.faces.inicio);
  const manter = no.manter
    ? {
        tipo: no.manter.tipo,
        quantos: inteiroEntre(avaliar(no.manter.quantidade, amb), 0, quantidade, 'Os dados mantidos', no.manter.quantidade.inicio),
      }
    : null;
  amb.rolagem.quantidade += quantidade;
  if (amb.rolagem.quantidade > LIMITE_DADOS_ROLAGEM) {
    throw new ErroDeFormula(`Uma rolagem pode ter no máximo ${LIMITE_DADOS_ROLAGEM} dados.`, no.inicio);
  }
  const valores = Array.from({ length: quantidade }, () => amb.rolarDado!(faces));
  const mantidos = manter ? escolherMantidos(valores, manter.tipo, manter.quantos) : valores.map(() => true);
  amb.rolagem.rolados.push({
    texto: `${quantidade}d${faces}${manter ? `${manter.tipo}${manter.quantos}` : ''}`,
    faces,
    valores,
    mantidos,
  });
  return valores.reduce((soma, valor, i) => (mantidos[i] ? soma + valor : soma), 0);
}

function novoAmbiente(
  formula: FormulaLida,
  contexto: ContextoFormula,
  rolarDado: Ambiente['rolarDado'],
): Ambiente {
  return { contexto, texto: formula.texto, rolarDado, rolagem: { rolados: [], quantidade: 0, tabelas: 0 } };
}

/** Uma parcela da conta, para mostrar de onde vem o resultado: "10", "mod(DES)" etc. */
export interface Parte {
  /** O trecho da fórmula, como `mod(DES)`. */
  readonly texto: string;
  /** Já com o sinal: em `10 - 2`, a segunda parte vale -2. */
  readonly valor: number;
  /** O nome citado, quando a parte é só um nome (`prof`) ou uma função de um nome (`mod(DES)` → `des`). */
  readonly nome?: string;
  /** A função, quando a parte é uma função de um nome, como `mod`. */
  readonly funcao?: string;
}

/** As parcelas de uma soma no nível de fora da fórmula: `10 + mod(DES) - 1` tem três. */
function parcelas(no: Arvore, sinal: 1 | -1, saida: { no: Arvore; sinal: 1 | -1 }[]): void {
  if (no.tipo === 'binaria' && (no.op === '+' || no.op === '-')) {
    parcelas(no.esquerda, sinal, saida);
    parcelas(no.direita, no.op === '+' ? sinal : sinal === 1 ? -1 : 1, saida);
  } else {
    saida.push({ no, sinal });
  }
}

function calcularPartes(formula: FormulaLida, amb: Ambiente): { valor: number; partes: Parte[] } {
  const itens: { no: Arvore; sinal: 1 | -1 }[] = [];
  parcelas(formula.arvore, 1, itens);
  const partes = itens.map(({ no, sinal }): Parte => {
    const valor = sinal * avaliar(no, amb);
    const texto = formula.texto.slice(no.inicio, no.fim);
    if (no.tipo === 'nome' && no.nome !== 'ilimitado') {
      return { texto, valor, nome: no.nome };
    }
    if (no.tipo === 'chamada' && no.argumentos.length === 1 && no.argumentos[0].tipo === 'nome') {
      return { texto, valor, nome: no.argumentos[0].nome, funcao: no.funcao };
    }
    return { texto, valor };
  });
  // Somar as partes já calculadas evita rolar os dados duas vezes.
  const valor = verificado(
    partes.reduce((soma, parte) => soma + parte.valor, 0),
    formula.arvore.inicio,
  );
  return { valor, partes };
}

/** Calcula uma fórmula sem dados, como os valores da ficha. */
export function calcularFormula(
  formula: FormulaLida,
  contexto: ContextoFormula,
): ResultadoFormula<{ readonly valor: number; readonly partes: readonly Parte[] }> {
  return comoResultado(() => calcularPartes(formula, novoAmbiente(formula, contexto, null)));
}

export interface Rolagem {
  readonly total: number;
  readonly partes: readonly Parte[];
  readonly dados: readonly DadoRolado[];
}

/** Rola uma fórmula com dados. `aleatorio` devolve um número de 0 (incluso) a 1, como Math.random. */
export function rolarFormula(
  formula: FormulaLida,
  contexto: ContextoFormula,
  aleatorio: () => number = Math.random,
): ResultadoFormula<Rolagem> {
  const rolarDado = (faces: number) => Math.min(faces, 1 + Math.floor(aleatorio() * faces));
  return comoResultado(() => {
    const amb = novoAmbiente(formula, contexto, rolarDado);
    const { valor, partes } = calcularPartes(formula, amb);
    return { total: valor, partes, dados: amb.rolagem.rolados };
  });
}

// ---------- Texto resolvido ----------

export function formatarNumero(valor: number): string {
  if (valor === Infinity) {
    return 'ilimitado';
  }
  if (valor === -Infinity) {
    return '-ilimitado';
  }
  return String(Math.round(valor * 100) / 100);
}

const PRECEDENCIA: Readonly<Record<OperadorBinario, number>> = {
  ou: 1,
  e: 2,
  '>=': 3,
  '<=': 3,
  '>': 3,
  '<': 3,
  '=': 3,
  '!=': 3,
  '+': 4,
  '-': 4,
  '*': 5,
  '/': 5,
};
const PRECEDENCIA_NEGATIVO = 6;
const PRECEDENCIA_ATOMO = 9;

/**
 * A fórmula com os nomes já trocados por números, mantendo os dados:
 * `1d8 + mod(FOR)` vira `1d8 + 3`. Sem dados, vira só o número.
 */
export function textoResolvido(formula: FormulaLida, contexto: ContextoFormula): ResultadoFormula<{ readonly texto: string }> {
  return comoResultado(() => {
    const amb = novoAmbiente(formula, contexto, null);

    const escrever = (no: Arvore, ambiente: Ambiente): { texto: string; precedencia: number } => {
      if (!temDadosResolvendo(no, ambiente)) {
        const valor = avaliar(no, ambiente);
        return { texto: formatarNumero(valor), precedencia: valor < 0 ? PRECEDENCIA_NEGATIVO : PRECEDENCIA_ATOMO };
      }
      switch (no.tipo) {
        case 'dados': {
          const q = avaliar(no.quantidade, ambiente);
          const f = avaliar(no.faces, ambiente);
          const manter = no.manter ? `${no.manter.tipo}${formatarNumero(avaliar(no.manter.quantidade, ambiente))}` : '';
          return { texto: `${formatarNumero(q)}d${formatarNumero(f)}${manter}`, precedencia: PRECEDENCIA_ATOMO };
        }
        case 'negativo': {
          const dentro = escrever(no.valor, ambiente);
          return {
            texto: `-${dentro.precedencia < PRECEDENCIA_NEGATIVO ? `(${dentro.texto})` : dentro.texto}`,
            precedencia: PRECEDENCIA_NEGATIVO,
          };
        }
        case 'binaria': {
          const minha = PRECEDENCIA[no.op];
          const esquerda = escrever(no.esquerda, ambiente);
          let op: string = no.op;
          let direita = escrever(no.direita, ambiente);
          // "1d8 + -1" fica "1d8 - 1".
          if ((op === '+' || op === '-') && direita.texto.startsWith('-') && direita.precedencia === PRECEDENCIA_NEGATIVO) {
            op = op === '+' ? '-' : '+';
            direita = { texto: direita.texto.slice(1), precedencia: PRECEDENCIA_ATOMO };
          }
          const textoEsquerda = esquerda.precedencia < minha ? `(${esquerda.texto})` : esquerda.texto;
          const textoDireita = direita.precedencia <= minha ? `(${direita.texto})` : direita.texto;
          // Parênteses à direita só quando mudam o resultado, como em "a - (b + c)".
          const direitaFinal =
            direita.precedencia === minha && (op === '+' || op === '*') ? direita.texto : textoDireita;
          return { texto: `${textoEsquerda} ${op} ${direitaFinal}`, precedencia: minha };
        }
        case 'chamada': {
          if (no.funcao === 'tabela') {
            const coluna = (no.argumentos[0] as { nome: string }).nome;
            const celula = ambiente.contexto.tabela?.(coluna);
            if (celula) {
              return escrever(celula.arvore, { ...ambiente, texto: celula.texto });
            }
          }
          const argumentos = no.argumentos.map((a) => escrever(a, ambiente).texto).join(', ');
          return { texto: `${no.funcao}(${argumentos})`, precedencia: PRECEDENCIA_ATOMO };
        }
        default:
          return { texto: formatarNumero(avaliar(no, ambiente)), precedencia: PRECEDENCIA_ATOMO };
      }
    };

    return { texto: escrever(formula.arvore, amb).texto };
  });
}

/** Como `temDados`, mas também enxerga dados vindos de uma coluna da tabela. */
function temDadosResolvendo(no: Arvore, amb: Ambiente): boolean {
  switch (no.tipo) {
    case 'dados':
      return true;
    case 'negativo':
      return temDadosResolvendo(no.valor, amb);
    case 'binaria':
      return temDadosResolvendo(no.esquerda, amb) || temDadosResolvendo(no.direita, amb);
    case 'chamada': {
      if (no.funcao === 'tabela') {
        const celula = amb.contexto.tabela?.((no.argumentos[0] as { nome: string }).nome);
        return celula !== undefined && amb.rolagem.tabelas < LIMITE_TABELAS_ANINHADAS && temDadosNaCelula(celula, amb);
      }
      return no.argumentos.some((a) => temDadosResolvendo(a, amb));
    }
    default:
      return false;
  }
}

function temDadosNaCelula(celula: FormulaLida, amb: Ambiente): boolean {
  amb.rolagem.tabelas++;
  try {
    return temDadosResolvendo(celula.arvore, amb);
  } finally {
    amb.rolagem.tabelas--;
  }
}
