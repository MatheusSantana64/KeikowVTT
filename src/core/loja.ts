import type { CoordHex } from './hex';
import { criarLojaComHistorico, type LojaComHistorico } from './lojaHistorico';
import { aplicarAcao, criarMapaVazio, type AcaoMapa, type EstadoMapa } from './mapa';
import type { OpcoesRegistro } from './registro';

export { LIMITE_HISTORICO } from './lojaHistorico';

/** Guarda o estado atual do mapa e o histórico. Toda mudança passa por uma ação. */
export type LojaMapa = LojaComHistorico<EstadoMapa, AcaoMapa>;

function coordDaAcao(acao: AcaoMapa): CoordHex | null {
  if ('coord' in acao) {
    return acao.coord;
  }
  return acao.tipo === 'MoverDecoracao' ? acao.destino : null;
}

export function criarLojaMapa(
  inicial: EstadoMapa = criarMapaVazio(),
  opcoes: OpcoesRegistro = {},
): LojaMapa {
  return criarLojaComHistorico(
    {
      inicial,
      aplicar: aplicarAcao,
      coordDaAcao,
      eventoDesfazer: 'Desfazer',
      eventoRefazer: 'Refazer',
    },
    opcoes,
  );
}
