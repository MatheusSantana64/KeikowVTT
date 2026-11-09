import type { Entrada, TipoEntrada } from './entradas';
import { criarLojaComHistorico, type LojaComHistorico } from './lojaHistorico';
import type { OpcoesRegistro } from './registro';

export interface EstadoCompendio {
  readonly entradas: Readonly<Record<string, Entrada>>;
}

export type AcaoCompendio =
  | { readonly tipo: 'AdicionarEntrada'; readonly entrada: Entrada }
  /** Troca a entrada inteira pela nova versão, mantendo id, tipo e origem. */
  | { readonly tipo: 'EditarEntrada'; readonly entrada: Entrada }
  | { readonly tipo: 'DuplicarEntrada'; readonly entradaId: string; readonly novoId: string }
  | { readonly tipo: 'RemoverEntrada'; readonly entradaId: string }
  /** Acrescenta várias entradas de uma vez. Nunca substitui as que já existem. */
  | { readonly tipo: 'ImportarEntradas'; readonly entradas: readonly Entrada[] }
  | { readonly tipo: 'CarregarCompendio'; readonly estado: EstadoCompendio };

export function criarCompendioVazio(): EstadoCompendio {
  return { entradas: {} };
}

export function entradaEm(estado: EstadoCompendio, id: string): Entrada | undefined {
  return estado.entradas[id];
}

function comEntrada(estado: EstadoCompendio, entrada: Entrada): EstadoCompendio {
  return { entradas: { ...estado.entradas, [entrada.id]: entrada } };
}

function editarEntrada(estado: EstadoCompendio, nova: Entrada): EstadoCompendio {
  const atual = entradaEm(estado, nova.id);
  if (!atual || atual.tipo !== nova.tipo) {
    return estado;
  }
  // A origem diz de onde a entrada veio: editar não muda isso.
  const editada = { ...nova, origem: atual.origem } as Entrada;
  return JSON.stringify(editada) === JSON.stringify(atual) ? estado : comEntrada(estado, editada);
}

function duplicarEntrada(estado: EstadoCompendio, entradaId: string, novoId: string): EstadoCompendio {
  const original = entradaEm(estado, entradaId);
  if (!original || entradaEm(estado, novoId)) {
    return estado;
  }
  return comEntrada(estado, {
    ...original,
    id: novoId,
    nome: `${original.nome} (cópia)`,
    origem: { tipo: 'campanha' },
  });
}

function removerEntrada(estado: EstadoCompendio, entradaId: string): EstadoCompendio {
  if (!entradaEm(estado, entradaId)) {
    return estado;
  }
  const entradas = { ...estado.entradas };
  delete entradas[entradaId];
  return { entradas };
}

function importarEntradas(estado: EstadoCompendio, novas: readonly Entrada[]): EstadoCompendio {
  const entradas = { ...estado.entradas };
  let alguma = false;
  for (const entrada of novas) {
    if (!(entrada.id in entradas)) {
      entradas[entrada.id] = entrada;
      alguma = true;
    }
  }
  return alguma ? { entradas } : estado;
}

/** Uma ação sem efeito devolve o mesmo objeto, como nas ações do mapa. */
export function aplicarAcaoCompendio(
  estado: EstadoCompendio,
  acao: AcaoCompendio,
): EstadoCompendio {
  switch (acao.tipo) {
    case 'AdicionarEntrada':
      return entradaEm(estado, acao.entrada.id) ? estado : comEntrada(estado, acao.entrada);
    case 'EditarEntrada':
      return editarEntrada(estado, acao.entrada);
    case 'DuplicarEntrada':
      return duplicarEntrada(estado, acao.entradaId, acao.novoId);
    case 'RemoverEntrada':
      return removerEntrada(estado, acao.entradaId);
    case 'ImportarEntradas':
      return importarEntradas(estado, acao.entradas);
    case 'CarregarCompendio':
      return acao.estado;
  }
}

export interface FiltroCompendio {
  /** Procura no nome e nas etiquetas, sem diferenciar maiúsculas nem acentos. */
  readonly texto?: string;
  readonly tipos?: readonly TipoEntrada[];
  /** Etiqueta exata, também sem diferenciar maiúsculas nem acentos. */
  readonly etiqueta?: string;
}

export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** As entradas que passam no filtro, em ordem alfabética. */
export function buscarEntradas(estado: EstadoCompendio, filtro: FiltroCompendio = {}): Entrada[] {
  const texto = normalizarBusca(filtro.texto ?? '');
  const etiqueta = normalizarBusca(filtro.etiqueta ?? '');
  const tipos = filtro.tipos && filtro.tipos.length > 0 ? new Set(filtro.tipos) : null;

  return Object.values(estado.entradas)
    .filter((entrada) => {
      if (tipos && !tipos.has(entrada.tipo)) {
        return false;
      }
      const etiquetas = entrada.etiquetas.map(normalizarBusca);
      if (etiqueta && !etiquetas.includes(etiqueta)) {
        return false;
      }
      return (
        !texto ||
        normalizarBusca(entrada.nome).includes(texto) ||
        etiquetas.some((e) => e.includes(texto))
      );
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
}

export type LojaCompendio = LojaComHistorico<EstadoCompendio, AcaoCompendio>;

export function criarLojaCompendio(
  inicial: EstadoCompendio = criarCompendioVazio(),
  opcoes: OpcoesRegistro = {},
): LojaCompendio {
  return criarLojaComHistorico(
    {
      inicial,
      aplicar: aplicarAcaoCompendio,
      eventoDesfazer: 'DesfazerCompendio',
      eventoRefazer: 'RefazerCompendio',
    },
    opcoes,
  );
}
