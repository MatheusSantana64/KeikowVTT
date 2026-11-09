import { useEffect, useRef, useState, type DragEvent } from 'react';
import type { CoordHex } from '../core/hex';
import { criarLojaMapa } from '../core/loja';
import type { Manifesto } from '../core/manifesto';
import { carregarManifesto } from '../render/assets';
import { createMapScene, type CenaMapa } from '../render/createMapScene';
import { Paleta } from './Paleta';

export function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const cenaRef = useRef<CenaMapa | null>(null);
  const tileArrastado = useRef<string | null>(null);
  const [loja] = useState(() => criarLojaMapa());
  const [manifesto, setManifesto] = useState<Manifesto | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [hexSobMouse, setHexSobMouse] = useState<CoordHex | null>(null);

  useEffect(() => {
    carregarManifesto()
      .then(setManifesto)
      .catch((motivo: unknown) => setErro(String(motivo)));
  }, []);

  useEffect(() => {
    if (!manifesto) {
      return;
    }
    const cena = createMapScene(mapRef.current!, {
      loja,
      manifesto,
      aoMudarHexSobMouse: setHexSobMouse,
    });
    cenaRef.current = cena;
    return () => {
      cena.destruir();
      cenaRef.current = null;
    };
  }, [loja, manifesto]);

  const hexDoEvento = (evento: DragEvent<HTMLElement>): CoordHex | null => {
    const limites = evento.currentTarget.getBoundingClientRect();
    return (
      cenaRef.current?.hexEm(evento.clientX - limites.left, evento.clientY - limites.top) ?? null
    );
  };

  const aoArrastarSobreMapa = (evento: DragEvent<HTMLElement>) => {
    const assetId = tileArrastado.current;
    if (!assetId) {
      return;
    }
    evento.preventDefault();
    evento.dataTransfer.dropEffect = 'copy';
    const coord = hexDoEvento(evento);
    if (coord) {
      cenaRef.current?.mostrarPrevia(assetId, coord);
    }
  };

  const aoSairDoMapa = (evento: DragEvent<HTMLElement>) => {
    // Passar do mapa para a tela dentro dele também dispara este evento.
    if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) {
      cenaRef.current?.limparPrevia();
    }
  };

  const aoSoltarNoMapa = (evento: DragEvent<HTMLElement>) => {
    const terreno = tileArrastado.current;
    if (!terreno) {
      return;
    }
    evento.preventDefault();
    const coord = hexDoEvento(evento);
    if (coord) {
      loja.despachar({ tipo: 'ColocarTile', coord, terreno });
    }
    cenaRef.current?.limparPrevia();
  };

  const aoTerminarArraste = () => {
    tileArrastado.current = null;
    cenaRef.current?.limparPrevia();
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>KeikowVTT</h1>
        <dl className="ajuda">
          <dt>Colocar tile</dt>
          <dd>Arrastar da paleta para o mapa</dd>
          <dt>Zoom</dt>
          <dd>Roda do mouse</dd>
          <dt>Mover o mapa</dt>
          <dd>Arrastar com o botão direito ou o do meio</dd>
        </dl>
        <p className="coordenada">
          {hexSobMouse ? `Hex: q ${hexSobMouse.q}, r ${hexSobMouse.r}` : 'Hex: —'}
        </p>
        {erro && <p className="erro">{erro}</p>}
        {manifesto && (
          <Paleta
            manifesto={manifesto}
            aoIniciarArraste={(assetId) => {
              tileArrastado.current = assetId;
            }}
            aoTerminarArraste={aoTerminarArraste}
          />
        )}
      </aside>
      <main
        className="map"
        ref={mapRef}
        onDragOver={aoArrastarSobreMapa}
        onDragLeave={aoSairDoMapa}
        onDrop={aoSoltarNoMapa}
      />
    </div>
  );
}
