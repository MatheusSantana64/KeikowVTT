import { useState, useSyncExternalStore } from 'react';
import type { AparenciaOculta } from '../core/aparencia';
import type { LojaMapa } from '../core/loja';
import type { Manifesto } from '../core/manifesto';
import { nomeAmigavel } from './nomeAmigavel';
import {
  fundoDaOpcao,
  OPCOES_APARENCIA,
  opcaoDoFundo,
  TILE_INICIAL,
  TILE_VOID,
  type IdOpcaoAparencia,
} from './opcoesAparencia';

interface SeletorAparenciaProps {
  readonly loja: LojaMapa;
  readonly manifesto: Manifesto;
}

export function SeletorAparencia({ loja, manifesto }: SeletorAparenciaProps) {
  const { aparenciaOculta } = useSyncExternalStore(loja.assinar, loja.obterEstado);
  const { fundo, bordasSuaves } = aparenciaOculta;
  const opcaoAtual = opcaoDoFundo(fundo);
  const [ultimoTile, setUltimoTile] = useState(TILE_INICIAL);
  const tileDaLista = opcaoAtual === 'tile' && fundo.tipo === 'tile' ? fundo.assetId : ultimoTile;

  const tiles = manifesto.assets.filter((asset) => asset.tipo === 'tile');
  const tileExiste = tiles.some((tile) => tile.id === tileDaLista);

  const aplicar = (aparencia: AparenciaOculta) =>
    loja.despachar({ tipo: 'DefinirAparenciaOculta', aparencia });

  const escolherOpcao = (id: IdOpcaoAparencia) =>
    aplicar({ bordasSuaves, fundo: fundoDaOpcao(id, tileDaLista) });

  const escolherTile = (assetId: string) => {
    if (assetId !== TILE_VOID) {
      setUltimoTile(assetId);
    }
    aplicar({ bordasSuaves, fundo: { tipo: 'tile', assetId } });
  };

  return (
    <div className="seletor-aparencia">
      {OPCOES_APARENCIA.map(({ id, rotulo }) => (
        <label key={id}>
          <input
            type="radio"
            name="aparencia-oculta"
            checked={opcaoAtual === id}
            onChange={() => escolherOpcao(id)}
          />
          {rotulo}
        </label>
      ))}
      <select
        aria-label="Tile usado nos hexes não vistos"
        value={tileDaLista}
        onChange={(evento) => escolherTile(evento.target.value)}
      >
        {!tileExiste && <option value={tileDaLista}>Imagem não encontrada</option>}
        {tiles.map((tile) => (
          <option key={tile.id} value={tile.id}>
            {nomeAmigavel(tile.id)}
          </option>
        ))}
      </select>
      <label>
        <input
          type="checkbox"
          checked={bordasSuaves}
          disabled={fundo.tipo === 'tile'}
          onChange={(evento) =>
            aplicar({ fundo, bordasSuaves: evento.target.checked })
          }
        />
        Bordas suaves
      </label>
    </div>
  );
}
