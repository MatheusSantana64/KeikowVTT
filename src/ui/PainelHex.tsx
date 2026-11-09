import { useSyncExternalStore } from 'react';
import type { CoordHex } from '../core/hex';
import type { LojaMapa } from '../core/loja';
import { hexEm } from '../core/mapa';
import { nomeAmigavel } from './nomeAmigavel';

interface PainelHexProps {
  readonly loja: LojaMapa;
  readonly coord: CoordHex;
  readonly aoFechar: () => void;
}

export function PainelHex({ loja, coord, aoFechar }: PainelHexProps) {
  const estado = useSyncExternalStore(loja.assinar, loja.obterEstado);
  const hex = hexEm(estado, coord);

  return (
    <aside className="painel-hex" aria-label="Informações do hex">
      <header>
        <div>
          <h2>{hex ? nomeAmigavel(hex.terreno) : 'Hex vazio'}</h2>
          <p className="painel-coordenada">
            q {coord.q}, r {coord.r}
          </p>
        </div>
        <button type="button" aria-label="Fechar painel" onClick={aoFechar}>
          ×
        </button>
      </header>
      {!hex && <p>Pinte um terreno neste hex para poder guardar informações nele.</p>}
    </aside>
  );
}
