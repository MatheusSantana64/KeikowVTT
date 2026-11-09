import type { Asset, Manifesto } from '../core/manifesto';
import { urlDoAsset } from '../render/assets';

interface PaletaProps {
  readonly manifesto: Manifesto;
  readonly tileSelecionado: string | null;
  readonly aoSelecionarTile: (assetId: string) => void;
  readonly aoIniciarArraste: (assetId: string) => void;
  readonly aoTerminarArraste: () => void;
}

/** "hexForestBroadleaf00" vira "Forest Broadleaf". */
function nomeAmigavel(id: string): string {
  return id
    .replace(/^hex/, '')
    .replace(/[\d-]+$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function Paleta({
  manifesto,
  tileSelecionado,
  aoSelecionarTile,
  aoIniciarArraste,
  aoTerminarArraste,
}: PaletaProps) {
  const tiles = manifesto.assets.filter((asset) => asset.tipo === 'tile');

  const tilesDaCategoria = (categoriaId: string): Asset[] =>
    tiles.filter((asset) => asset.categoria === categoriaId);

  return (
    <div className="paleta">
      {manifesto.categorias
        .filter((categoria) => tilesDaCategoria(categoria.id).length > 0)
        .map((categoria) => (
          <details key={categoria.id} open>
            <summary>{categoria.nome}</summary>
            <div className="paleta-grade">
              {tilesDaCategoria(categoria.id).map((tile) => (
                <figure
                  key={tile.id}
                  title={nomeAmigavel(tile.id)}
                  className={tile.id === tileSelecionado ? 'selecionado' : undefined}
                >
                  <img
                    src={urlDoAsset(tile)}
                    alt={nomeAmigavel(tile.id)}
                    data-asset-id={tile.id}
                    draggable
                    onClick={() => aoSelecionarTile(tile.id)}
                    onDragStart={(evento) => {
                      evento.dataTransfer.setData('text/plain', tile.id);
                      evento.dataTransfer.effectAllowed = 'copy';
                      aoIniciarArraste(tile.id);
                    }}
                    onDragEnd={aoTerminarArraste}
                  />
                  <figcaption>{nomeAmigavel(tile.id)}</figcaption>
                </figure>
              ))}
            </div>
          </details>
        ))}
    </div>
  );
}
