import { chaveHex, hexParaMundo, type ChaveHex, type CoordHex, type PontoMundo } from './hex';
import type { Visibilidade } from './visibilidade';

export interface Decoracao {
  readonly id: string;
  readonly assetId: string;
  /** Posição em pixels relativa ao centro do hex onde a decoração está. */
  readonly deslocamento: PontoMundo;
}

export interface Nota {
  readonly id: string;
  readonly texto: string;
  readonly visibilidade: Visibilidade;
}

/** O que o mestre escreve sobre um hex. Nome e descrição são visíveis a todos. */
export interface InformacaoHex {
  readonly nome: string;
  readonly descricao: string;
  readonly notas: readonly Nota[];
}

export const INFORMACAO_VAZIA: InformacaoHex = { nome: '', descricao: '', notas: [] };

export interface Hex extends InformacaoHex {
  readonly coord: CoordHex;
  /** Id do tile no manifesto de assets. A imagem em si não faz parte do estado. */
  readonly terreno: string;
  readonly decoracoes: readonly Decoracao[];
}

export interface EstadoMapa {
  /** Só os hexes preenchidos existem aqui, então o mapa não tem limite de tamanho. */
  readonly hexes: Readonly<Record<ChaveHex, Hex>>;
}

export type AcaoMapa =
  | { readonly tipo: 'ColocarTile'; readonly coord: CoordHex; readonly terreno: string }
  | { readonly tipo: 'RemoverTile'; readonly coord: CoordHex }
  | { readonly tipo: 'ColocarDecoracao'; readonly coord: CoordHex; readonly decoracao: Decoracao }
  | {
      readonly tipo: 'MoverDecoracao';
      readonly origem: CoordHex;
      readonly decoracaoId: string;
      readonly destino: CoordHex;
      readonly deslocamento: PontoMundo;
    }
  | { readonly tipo: 'RemoverDecoracao'; readonly coord: CoordHex; readonly decoracaoId: string }
  | { readonly tipo: 'CarregarMapa'; readonly estado: EstadoMapa }
  | {
      readonly tipo: 'EditarInformacaoHex';
      readonly coord: CoordHex;
      readonly campos: Partial<Pick<InformacaoHex, 'nome' | 'descricao'>>;
    }
  | { readonly tipo: 'AdicionarNota'; readonly coord: CoordHex; readonly nota: Nota }
  | {
      readonly tipo: 'EditarNota';
      readonly coord: CoordHex;
      readonly notaId: string;
      readonly texto: string;
    }
  | {
      readonly tipo: 'DefinirVisibilidadeNota';
      readonly coord: CoordHex;
      readonly notaId: string;
      readonly visibilidade: Visibilidade;
    }
  | { readonly tipo: 'RemoverNota'; readonly coord: CoordHex; readonly notaId: string };

export function criarMapaVazio(): EstadoMapa {
  return { hexes: {} };
}

export function hexEm(estado: EstadoMapa, coord: CoordHex): Hex | undefined {
  return estado.hexes[chaveHex(coord)];
}

/** Só conta o que tem texto de verdade: notas em branco não são anotações. */
export function temAnotacoes(hex: Hex): boolean {
  return [hex.nome, hex.descricao, ...hex.notas.map((nota) => nota.texto)].some(
    (texto) => texto.trim() !== '',
  );
}

/**
 * Única forma de mudar o mapa. Nunca altera o estado recebido: devolve um novo.
 * Uma ação sem efeito devolve o mesmo objeto, o que permite detectar que nada mudou.
 */
export function aplicarAcao(estado: EstadoMapa, acao: AcaoMapa): EstadoMapa {
  switch (acao.tipo) {
    case 'ColocarTile':
      return colocarTile(estado, acao.coord, acao.terreno);
    case 'RemoverTile':
      return removerTile(estado, acao.coord);
    case 'ColocarDecoracao':
      return colocarDecoracao(estado, acao.coord, acao.decoracao);
    case 'MoverDecoracao':
      return moverDecoracao(estado, acao.origem, acao.decoracaoId, acao.destino, acao.deslocamento);
    case 'RemoverDecoracao':
      return removerDecoracao(estado, acao.coord, acao.decoracaoId);
    case 'CarregarMapa':
      return acao.estado;
    case 'EditarInformacaoHex':
      return editarInformacaoHex(estado, acao.coord, acao.campos);
    case 'AdicionarNota':
      return adicionarNota(estado, acao.coord, acao.nota);
    case 'EditarNota':
      return alterarNota(estado, acao.coord, acao.notaId, (nota) =>
        nota.texto === acao.texto ? nota : { ...nota, texto: acao.texto },
      );
    case 'DefinirVisibilidadeNota':
      return alterarNota(estado, acao.coord, acao.notaId, (nota) =>
        nota.visibilidade.tipo === acao.visibilidade.tipo
          ? nota
          : { ...nota, visibilidade: acao.visibilidade },
      );
    case 'RemoverNota':
      return removerNota(estado, acao.coord, acao.notaId);
  }
}

/** Centro do retângulo que contém todos os hexes, ou `null` se o mapa estiver vazio. */
export function centroDoMapa(estado: EstadoMapa): PontoMundo | null {
  const centros = Object.values(estado.hexes).map((hex) => hexParaMundo(hex.coord));
  if (centros.length === 0) {
    return null;
  }
  const xs = centros.map((c) => c.x);
  const ys = centros.map((c) => c.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

function comHex(estado: EstadoMapa, hex: Hex): EstadoMapa {
  return { hexes: { ...estado.hexes, [chaveHex(hex.coord)]: hex } };
}

function colocarTile(estado: EstadoMapa, coord: CoordHex, terreno: string): EstadoMapa {
  const hex = hexEm(estado, coord);
  if (!hex) {
    return comHex(estado, { ...INFORMACAO_VAZIA, coord, terreno, decoracoes: [] });
  }
  if (hex.terreno === terreno) {
    return estado;
  }
  // Trocar o terreno mantém decorações e anotações; elas só somem quando o hex é apagado.
  return comHex(estado, { ...hex, terreno });
}

function removerTile(estado: EstadoMapa, coord: CoordHex): EstadoMapa {
  if (!hexEm(estado, coord)) {
    return estado;
  }
  const hexes = { ...estado.hexes };
  delete hexes[chaveHex(coord)];
  return { hexes };
}

function colocarDecoracao(estado: EstadoMapa, coord: CoordHex, decoracao: Decoracao): EstadoMapa {
  const hex = hexEm(estado, coord);
  if (!hex || hex.decoracoes.some((d) => d.id === decoracao.id)) {
    return estado;
  }
  return comHex(estado, { ...hex, decoracoes: [...hex.decoracoes, decoracao] });
}

function moverDecoracao(
  estado: EstadoMapa,
  origem: CoordHex,
  decoracaoId: string,
  destino: CoordHex,
  deslocamento: PontoMundo,
): EstadoMapa {
  const hexOrigem = hexEm(estado, origem);
  const hexDestino = hexEm(estado, destino);
  const decoracao = hexOrigem?.decoracoes.find((d) => d.id === decoracaoId);
  if (!hexOrigem || !hexDestino || !decoracao) {
    return estado;
  }

  if (hexOrigem === hexDestino) {
    const decoracoes = hexOrigem.decoracoes.map((d) =>
      d.id === decoracaoId ? { ...d, deslocamento } : d,
    );
    return comHex(estado, { ...hexOrigem, decoracoes });
  }

  const semDecoracao = removerDecoracao(estado, origem, decoracaoId);
  return colocarDecoracao(semDecoracao, destino, { ...decoracao, deslocamento });
}

function editarInformacaoHex(
  estado: EstadoMapa,
  coord: CoordHex,
  campos: Partial<Pick<InformacaoHex, 'nome' | 'descricao'>>,
): EstadoMapa {
  const hex = hexEm(estado, coord);
  if (!hex) {
    return estado;
  }
  const nome = campos.nome ?? hex.nome;
  const descricao = campos.descricao ?? hex.descricao;
  if (nome === hex.nome && descricao === hex.descricao) {
    return estado;
  }
  return comHex(estado, { ...hex, nome, descricao });
}

function adicionarNota(estado: EstadoMapa, coord: CoordHex, nota: Nota): EstadoMapa {
  const hex = hexEm(estado, coord);
  if (!hex || hex.notas.some((n) => n.id === nota.id)) {
    return estado;
  }
  return comHex(estado, { ...hex, notas: [...hex.notas, nota] });
}

/** `mudar` devolve a mesma nota quando não há o que alterar. */
function alterarNota(
  estado: EstadoMapa,
  coord: CoordHex,
  notaId: string,
  mudar: (nota: Nota) => Nota,
): EstadoMapa {
  const hex = hexEm(estado, coord);
  const nota = hex?.notas.find((n) => n.id === notaId);
  if (!hex || !nota) {
    return estado;
  }
  const alterada = mudar(nota);
  if (alterada === nota) {
    return estado;
  }
  return comHex(estado, { ...hex, notas: hex.notas.map((n) => (n === nota ? alterada : n)) });
}

function removerNota(estado: EstadoMapa, coord: CoordHex, notaId: string): EstadoMapa {
  const hex = hexEm(estado, coord);
  if (!hex || !hex.notas.some((n) => n.id === notaId)) {
    return estado;
  }
  return comHex(estado, { ...hex, notas: hex.notas.filter((n) => n.id !== notaId) });
}

function removerDecoracao(estado: EstadoMapa, coord: CoordHex, decoracaoId: string): EstadoMapa {
  const hex = hexEm(estado, coord);
  if (!hex || !hex.decoracoes.some((d) => d.id === decoracaoId)) {
    return estado;
  }
  return comHex(estado, { ...hex, decoracoes: hex.decoracoes.filter((d) => d.id !== decoracaoId) });
}
