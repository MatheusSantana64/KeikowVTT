import { useState } from 'react';
import type { Asset, Manifesto } from '../core/manifesto';
import { urlDoAsset } from '../render/assets';

type Aba = 'terrenos' | 'decoracoes';

interface PaletaProps {
  readonly manifesto: Manifesto;
  readonly assetSelecionado: string | null;
  readonly aoSelecionarAsset: (assetId: string) => void;
  readonly aoIniciarArraste: (assetId: string) => void;
  readonly aoTerminarArraste: () => void;
}

/** "hexForestBroadleaf00" vira "Forest Broadleaf". */
function nomeAmigavel(id: string): string {
  return id
    .replace(/^hex/, '')
    .replace(/[_\d-]+$/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
}

function pertenceAba(asset: Asset, aba: Aba): boolean {
  return aba === 'terrenos'
    ? asset.tipo === 'tile'
    : asset.tipo === 'decoracao' || asset.tipo === 'sobreposicao';
}

export function Paleta({
  manifesto,
  assetSelecionado,
  aoSelecionarAsset,
  aoIniciarArraste,
  aoTerminarArraste,
}: PaletaProps) {
  const [aba, setAba] = useState<Aba>('terrenos');

  const assetsDaCategoria = (categoriaId: string): Asset[] =>
    manifesto.assets.filter((asset) => asset.categoria === categoriaId && pertenceAba(asset, aba));

  return (
    <div className="paleta-bloco">
      <div className="paleta-abas" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'terrenos'}
          onClick={() => setAba('terrenos')}
        >
          Terrenos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={aba === 'decoracoes'}
          onClick={() => setAba('decoracoes')}
        >
          Decorações e rios
        </button>
      </div>
      <div className={`paleta paleta-${aba}`}>
        {manifesto.categorias
          .filter((categoria) => assetsDaCategoria(categoria.id).length > 0)
          .map((categoria) => (
            <details key={categoria.id} open>
              <summary>{categoria.nome}</summary>
              <div className="paleta-grade">
                {assetsDaCategoria(categoria.id).map((asset) => (
                  <figure
                    key={asset.id}
                    title={nomeAmigavel(asset.id)}
                    className={asset.id === assetSelecionado ? 'selecionado' : undefined}
                  >
                    <img
                      src={urlDoAsset(asset)}
                      alt={nomeAmigavel(asset.id)}
                      data-asset-id={asset.id}
                      draggable
                      onClick={() => aoSelecionarAsset(asset.id)}
                      onDragStart={(evento) => {
                        evento.dataTransfer.setData('text/plain', asset.id);
                        evento.dataTransfer.effectAllowed = 'copy';
                        aoIniciarArraste(asset.id);
                      }}
                      onDragEnd={aoTerminarArraste}
                    />
                    <figcaption>{nomeAmigavel(asset.id)}</figcaption>
                  </figure>
                ))}
              </div>
            </details>
          ))}
      </div>
    </div>
  );
}
