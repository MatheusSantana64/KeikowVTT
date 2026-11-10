/**
 * A organização livre da ficha: cada item, habilidade, magia ou nota é uma carta,
 * e o jogador decide em que seção e em que ordem ela fica.
 *
 * Cartas que o jogador ainda não arrumou (como uma habilidade ganha ao subir de nível)
 * aparecem no fim da seção padrão do tipo delas.
 */
import { habilidadesDaFicha, type HabilidadeNaFicha } from './calculoDaFicha';
import type { Entrada, EntradaDe } from './entradas';
import {
  chaveDaEntrada,
  chaveDaNota,
  chaveDoItem,
  entradaDaFicha,
  type Ficha,
  type NotaDaFicha,
  type PilhaDeItem,
  type SecaoDaFicha,
  type TipoExtra,
} from './fichas';
import type { Regras } from './regras';

export type Carta =
  | {
      readonly tipo: 'item';
      readonly chave: string;
      readonly pilha: PilhaDeItem;
      readonly entrada: EntradaDe<'item'>;
    }
  | {
      readonly tipo: 'entrada';
      readonly chave: string;
      readonly entrada: Extract<Entrada, { tipo: TipoExtra }>;
      /** De onde veio: "Barbarian 1", "Hill Dwarf" ou "acrescentada". */
      readonly origem: string;
      /** Acrescentada à mão (pode ser tirada) ou vinda da classe, espécie ou antecedente. */
      readonly extra: boolean;
      /** Para calcular usos com a tabela da classe. */
      readonly habilidade: HabilidadeNaFicha | null;
    }
  | { readonly tipo: 'nota'; readonly chave: string; readonly nota: NotaDaFicha };

export interface SecaoOrganizada {
  readonly secao: SecaoDaFicha;
  readonly cartas: readonly Carta[];
}

/** Todas as cartas que a ficha tem agora, cada uma com a seção para onde vai se ainda não foi arrumada. */
function cartasDaFicha(ficha: Ficha): { carta: Carta; secaoPadrao: string }[] {
  const lista: { carta: Carta; secaoPadrao: string }[] = [];
  for (const pilha of ficha.itens) {
    const entrada = entradaDaFicha(ficha, pilha.entradaId, 'item');
    if (entrada) {
      lista.push({
        carta: { tipo: 'item', chave: chaveDoItem(pilha.id), pilha, entrada },
        secaoPadrao: pilha.equipado ? 'equipado' : 'mochila',
      });
    }
  }
  const vistas = new Set<string>();
  for (const habilidade of habilidadesDaFicha(ficha)) {
    vistas.add(habilidade.entrada.id);
    lista.push({
      carta: {
        tipo: 'entrada',
        chave: chaveDaEntrada(habilidade.entrada.id),
        entrada: habilidade.entrada,
        origem: habilidade.origem,
        extra: false,
        habilidade,
      },
      secaoPadrao: 'habilidades',
    });
  }
  for (const id of ficha.extras) {
    const entrada = ficha.entradas[id];
    if (!entrada || vistas.has(id) || (entrada.tipo !== 'habilidade' && entrada.tipo !== 'magia' && entrada.tipo !== 'talento')) {
      continue;
    }
    vistas.add(id);
    lista.push({
      carta: {
        tipo: 'entrada',
        chave: chaveDaEntrada(id),
        entrada,
        origem: 'acrescentada',
        extra: true,
        habilidade: entrada.tipo === 'habilidade' ? { entrada, origem: 'acrescentada', classe: null } : null,
      },
      secaoPadrao: entrada.tipo === 'magia' ? 'magias' : 'habilidades',
    });
  }
  for (const nota of ficha.notas) {
    lista.push({ carta: { tipo: 'nota', chave: chaveDaNota(nota.id), nota }, secaoPadrao: 'notas' });
  }
  return lista;
}

/** As seções na ordem do jogador, com as cartas de cada uma, inclusive as ainda não arrumadas. */
export function secoesOrganizadas(ficha: Ficha): SecaoOrganizada[] {
  const cartas = cartasDaFicha(ficha);
  const porChave = new Map(cartas.map((c) => [c.carta.chave, c]));
  const arrumadas = new Set<string>();
  const resultado = ficha.secoes.map((secao) => {
    const lista: Carta[] = [];
    for (const chave of secao.cartas) {
      const encontrada = porChave.get(chave);
      // Uma carta citada duas vezes fica só na primeira seção.
      if (encontrada && !arrumadas.has(chave)) {
        arrumadas.add(chave);
        lista.push(encontrada.carta);
      }
    }
    return { secao, cartas: lista };
  });
  for (const { carta, secaoPadrao } of cartas) {
    if (arrumadas.has(carta.chave) || resultado.length === 0) {
      continue;
    }
    const destino = resultado.find((r) => r.secao.id === secaoPadrao) ?? resultado[0];
    destino.cartas = [...destino.cartas, carta];
  }
  return resultado;
}

/**
 * Leva uma carta para uma seção, na posição pedida (contada entre as cartas que aparecem ali).
 * A arrumação que estava na tela fica guardada, para nada mudar de lugar sozinho depois.
 */
export function comCartaMovida(ficha: Ficha, chave: string, secaoId: string, posicao: number): Ficha {
  const organizadas = secoesOrganizadas(ficha);
  if (!organizadas.some((o) => o.cartas.some((c) => c.chave === chave)) || !organizadas.some((o) => o.secao.id === secaoId)) {
    return ficha;
  }
  const secoes = organizadas.map(({ secao, cartas }) => {
    const chaves = cartas.map((c) => c.chave).filter((c) => c !== chave);
    if (secao.id === secaoId) {
      // A posição foi contada com a carta ainda no lugar antigo; dentro da mesma seção, isso desloca um.
      const antes = cartas.findIndex((c) => c.chave === chave);
      const destino = antes >= 0 && antes < posicao ? posicao - 1 : posicao;
      const limitado = Math.max(0, Math.min(destino, chaves.length));
      chaves.splice(limitado, 0, chave);
    }
    return { ...secao, cartas: chaves };
  });
  return { ...ficha, secoes };
}

/** Peso que a ficha carrega, em quilos: itens vezes quantidade, mais as moedas. */
export function pesoCarregado(ficha: Ficha, regras: Regras): { readonly itens: number; readonly moedas: number; readonly total: number } {
  const itens = ficha.itens.reduce((soma, pilha) => {
    const item = entradaDaFicha(ficha, pilha.entradaId, 'item');
    return soma + (item ? item.dados.peso * pilha.quantidade : 0);
  }, 0);
  const quantasMoedas = Object.values(ficha.moedas).reduce((s, n) => s + n, 0);
  const moedas = quantasMoedas * regras.pesoPorMoeda;
  return { itens, moedas, total: itens + moedas };
}
