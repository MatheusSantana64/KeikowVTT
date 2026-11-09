import { SO_MESTRE, type Visibilidade } from './visibilidade';

/** Força, Destreza, Constituição, Inteligência, Sabedoria e Carisma. */
export const ATRIBUTOS = ['for', 'des', 'con', 'int', 'sab', 'car'] as const;
export type Atributo = (typeof ATRIBUTOS)[number];

export const TIPOS_ENTRADA = [
  'item',
  'magia',
  'habilidade',
  'classe',
  'especie',
  'antecedente',
  'talento',
  'condicao',
  'monstro',
] as const;
export type TipoEntrada = (typeof TIPOS_ENTRADA)[number];

/** Peças de cobre, prata, electro, ouro e platina. */
export const MOEDAS = ['pc', 'pp', 'pe', 'po', 'pl'] as const;
export const RARIDADES = [
  'comum',
  'incomum',
  'raro',
  'muito-raro',
  'lendario',
  'artefato',
  'variada',
] as const;
export const CATEGORIAS_ITEM = [
  'arma',
  'armadura',
  'escudo',
  'consumivel',
  'municao',
  'ferramenta',
  'montaria',
  'equipamento',
  'tesouro',
] as const;
export const TAMANHOS = ['miudo', 'pequeno', 'medio', 'grande', 'enorme', 'imenso'] as const;
export const ESCOLAS_MAGIA = [
  'abjuracao',
  'adivinhacao',
  'conjuracao',
  'encantamento',
  'evocacao',
  'ilusao',
  'necromancia',
  'transmutacao',
] as const;
export const RECARGAS = ['descanso-curto', 'descanso-longo', 'aurora'] as const;
export const PESOS_ARMADURA = ['leve', 'media', 'pesada', 'escudo'] as const;
export const QUANDO_EFEITO = ['sempre', 'equipado', 'sintonizado'] as const;

/** De onde veio a entrada: criada nesta campanha, ou trazida de um pacote como o SRD. */
export type OrigemEntrada =
  | { readonly tipo: 'campanha' }
  | { readonly tipo: 'pacote'; readonly pacote: string };

/**
 * Um modificador que a entrada aplica na ficha de quem a tem, como "+1 na CA".
 * `alvo` e `valor` são interpretados pelo motor de regras.
 */
export interface Efeito {
  readonly id: string;
  readonly alvo: string;
  readonly operacao: 'somar' | 'definir';
  /** Fórmula, como `1` ou `mod(DES)`. */
  readonly valor: string;
  readonly quando: (typeof QUANDO_EFEITO)[number];
}

/** Uma etapa do que acontece ao usar uma ação, como rolar dados ou curar. */
export type PassoDeAcao =
  | { readonly tipo: 'rolar'; readonly formula: string; readonly rotulo: string }
  | { readonly tipo: 'curar'; readonly formula: string }
  | { readonly tipo: 'consumir'; readonly quantidade: number };

/** Uma opção do menu do botão direito, vinda da própria entrada, como "Beber" numa poção. */
export interface AcaoDeEntrada {
  readonly id: string;
  readonly rotulo: string;
  readonly passos: readonly PassoDeAcao[];
}

export interface BlocoDeTexto {
  readonly nome: string;
  readonly descricao: string;
}

export interface DadosArma {
  readonly dominio: 'simples' | 'marcial';
  readonly alcanceTipo: 'corpo-a-corpo' | 'distancia';
  /** Fórmula de dados, como `1d8`. */
  readonly dano: string;
  readonly tipoDano: string;
  readonly danoVersatil: string | null;
  /** Em pés, como no SRD. */
  readonly alcance: { readonly normal: number; readonly longo: number | null } | null;
  readonly propriedades: readonly string[];
}

export interface DadosArmadura {
  readonly peso: (typeof PESOS_ARMADURA)[number];
  /** No escudo, é o bônus que ele dá. */
  readonly caBase: number;
  readonly usaDestreza: boolean;
  /** `null` quando não há limite. */
  readonly destrezaMaxima: number | null;
  readonly forcaMinima: number;
  readonly desvantagemFurtividade: boolean;
}

export interface DadosItem {
  readonly categoria: (typeof CATEGORIAS_ITEM)[number];
  /** Em libras, como no SRD. */
  readonly peso: number;
  readonly custo: { readonly quantidade: number; readonly moeda: (typeof MOEDAS)[number] } | null;
  readonly raridade: (typeof RARIDADES)[number] | null;
  readonly requerSintonia: boolean;
  readonly empilhavel: boolean;
  readonly arma: DadosArma | null;
  readonly armadura: DadosArmadura | null;
}

export interface DadosMagia {
  /** 0 para truques. */
  readonly nivel: number;
  readonly escola: (typeof ESCOLAS_MAGIA)[number];
  readonly tempoConjuracao: string;
  readonly alcance: string;
  readonly componentes: {
    readonly verbal: boolean;
    readonly somatico: boolean;
    readonly material: string | null;
  };
  readonly duracao: string;
  readonly concentracao: boolean;
  readonly ritual: boolean;
  /** Ids das entradas de classe que podem aprender a magia. */
  readonly classes: readonly string[];
}

export interface DadosHabilidade {
  /** Texto livre, como "Guerreiro 2" ou "Anão". */
  readonly requisito: string;
  readonly usos: {
    /** Fórmula, como `1` ou `mod(CAR)`. */
    readonly maximo: string;
    readonly recarga: (typeof RECARGAS)[number];
  } | null;
}

export interface DadosClasse {
  readonly dadoVida: number;
  readonly salvaguardas: readonly Atributo[];
  readonly proficiencias: readonly string[];
  /** Ids das entradas de habilidade ganhas em cada nível. */
  readonly habilidades: readonly { readonly nivel: number; readonly entradaId: string }[];
  readonly atributoConjuracao: Atributo | null;
}

export interface DadosEspecie {
  readonly tamanho: (typeof TAMANHOS)[number];
  /** Em pés, como no SRD. */
  readonly deslocamento: number;
  readonly aumentosAtributo: Readonly<Partial<Record<Atributo, number>>>;
  readonly idiomas: readonly string[];
  /** Ids das entradas de habilidade da espécie. */
  readonly tracos: readonly string[];
}

export interface DadosAntecedente {
  readonly proficiencias: readonly string[];
  readonly habilidades: readonly string[];
}

export interface DadosTalento {
  readonly prerequisito: string;
}

/** Condições não têm dados próprios: o que elas fazem está nos efeitos. */
export type DadosCondicao = Readonly<Record<string, never>>;

export interface DadosMonstro {
  readonly tamanho: (typeof TAMANHOS)[number];
  readonly tipoCriatura: string;
  readonly alinhamento: string;
  readonly classeArmadura: number;
  /** De onde vem a CA, como "armadura natural" ou "couro, escudo". Vazio quando não há nota. */
  readonly notaArmadura: string;
  readonly pontosVida: number;
  /** Fórmula, como `2d8+2`. */
  readonly dadosVida: string;
  readonly deslocamento: string;
  readonly atributos: Readonly<Record<Atributo, number>>;
  readonly salvaguardas: Readonly<Partial<Record<Atributo, number>>>;
  readonly pericias: Readonly<Record<string, number>>;
  readonly vulnerabilidades: readonly string[];
  readonly resistencias: readonly string[];
  readonly imunidades: readonly string[];
  readonly imunidadesCondicao: readonly string[];
  readonly sentidos: string;
  readonly idiomas: string;
  readonly nivelDesafio: number;
  readonly experiencia: number;
  readonly tracos: readonly BlocoDeTexto[];
  readonly acoesDeCombate: readonly BlocoDeTexto[];
  readonly reacoes: readonly BlocoDeTexto[];
  readonly acoesLendarias: readonly BlocoDeTexto[];
}

export interface DadosPorTipo {
  readonly item: DadosItem;
  readonly magia: DadosMagia;
  readonly habilidade: DadosHabilidade;
  readonly classe: DadosClasse;
  readonly especie: DadosEspecie;
  readonly antecedente: DadosAntecedente;
  readonly talento: DadosTalento;
  readonly condicao: DadosCondicao;
  readonly monstro: DadosMonstro;
}

export interface EntradaDe<T extends TipoEntrada> {
  readonly id: string;
  readonly tipo: T;
  readonly nome: string;
  readonly descricao: string;
  readonly etiquetas: readonly string[];
  readonly origem: OrigemEntrada;
  readonly visibilidade: Visibilidade;
  readonly efeitos: readonly Efeito[];
  readonly acoes: readonly AcaoDeEntrada[];
  readonly dados: DadosPorTipo[T];
}

/** Qualquer coisa do compêndio: item, magia, monstro etc. */
export type Entrada = { [T in TipoEntrada]: EntradaDe<T> }[TipoEntrada];

const ATRIBUTOS_PADRAO: Record<Atributo, number> = {
  for: 10,
  des: 10,
  con: 10,
  int: 10,
  sab: 10,
  car: 10,
};

const DADOS_INICIAIS: { readonly [T in TipoEntrada]: () => DadosPorTipo[T] } = {
  item: () => ({
    categoria: 'equipamento',
    peso: 0,
    custo: null,
    raridade: null,
    requerSintonia: false,
    empilhavel: false,
    arma: null,
    armadura: null,
  }),
  magia: () => ({
    nivel: 0,
    escola: 'evocacao',
    tempoConjuracao: '1 ação',
    alcance: '',
    componentes: { verbal: false, somatico: false, material: null },
    duracao: 'Instantânea',
    concentracao: false,
    ritual: false,
    classes: [],
  }),
  habilidade: () => ({ requisito: '', usos: null }),
  classe: () => ({
    dadoVida: 8,
    salvaguardas: [],
    proficiencias: [],
    habilidades: [],
    atributoConjuracao: null,
  }),
  especie: () => ({
    tamanho: 'medio',
    deslocamento: 30,
    aumentosAtributo: {},
    idiomas: [],
    tracos: [],
  }),
  antecedente: () => ({ proficiencias: [], habilidades: [] }),
  talento: () => ({ prerequisito: '' }),
  condicao: () => ({}),
  monstro: () => ({
    tamanho: 'medio',
    tipoCriatura: '',
    alinhamento: '',
    classeArmadura: 10,
    notaArmadura: '',
    pontosVida: 1,
    dadosVida: '1d8',
    deslocamento: '30 pés',
    atributos: { ...ATRIBUTOS_PADRAO },
    salvaguardas: {},
    pericias: {},
    vulnerabilidades: [],
    resistencias: [],
    imunidades: [],
    imunidadesCondicao: [],
    sentidos: '',
    idiomas: '',
    nivelDesafio: 0,
    experiencia: 0,
    tracos: [],
    acoesDeCombate: [],
    reacoes: [],
    acoesLendarias: [],
  }),
};

/**
 * Uma entrada nova, criada pelo mestre: começa visível só para ele.
 * Funciona também com um tipo escolhido na hora, como numa lista de opções.
 */
export function criarEntrada<T extends TipoEntrada>(tipo: T, id: string): Extract<Entrada, { tipo: T }> {
  const entrada: EntradaDe<T> = {
    id,
    tipo,
    nome: '',
    descricao: '',
    etiquetas: [],
    origem: { tipo: 'campanha' },
    visibilidade: SO_MESTRE,
    efeitos: [],
    acoes: [],
    dados: DADOS_INICIAIS[tipo](),
  };
  // O TypeScript não consegue provar sozinho que os dados de DADOS_INICIAIS[tipo] combinam com o tipo,
  // mas o mapa acima é verificado tipo a tipo.
  return entrada as unknown as Extract<Entrada, { tipo: T }>;
}
