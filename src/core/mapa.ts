import { chaveHex, type ChaveHex, type CoordHex, type PontoMundo } from './hex';

export interface Decoracao {
  readonly id: string;
  readonly assetId: string;
  /** Posição em pixels relativa ao centro do hex onde a decoração está. */
  readonly deslocamento: PontoMundo;
}

export interface Hex {
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
  | { readonly tipo: 'RemoverDecoracao'; readonly coord: CoordHex; readonly decoracaoId: string };

export function criarMapaVazio(): EstadoMapa {
  return { hexes: {} };
}

export function hexEm(estado: EstadoMapa, coord: CoordHex): Hex | undefined {
  return estado.hexes[chaveHex(coord)];
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
  }
}

function comHex(estado: EstadoMapa, hex: Hex): EstadoMapa {
  return { hexes: { ...estado.hexes, [chaveHex(hex.coord)]: hex } };
}

function colocarTile(estado: EstadoMapa, coord: CoordHex, terreno: string): EstadoMapa {
  const hex = hexEm(estado, coord);
  if (!hex) {
    return comHex(estado, { coord, terreno, decoracoes: [] });
  }
  if (hex.terreno === terreno) {
    return estado;
  }
  // Trocar o terreno mantém as decorações; elas só somem quando o hex é apagado.
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

function removerDecoracao(estado: EstadoMapa, coord: CoordHex, decoracaoId: string): EstadoMapa {
  const hex = hexEm(estado, coord);
  if (!hex || !hex.decoracoes.some((d) => d.id === decoracaoId)) {
    return estado;
  }
  return comHex(estado, { ...hex, decoracoes: hex.decoracoes.filter((d) => d.id !== decoracaoId) });
}
