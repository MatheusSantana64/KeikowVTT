import { useEffect, useRef, useState } from 'react';
import type { CoordHex } from '../core/hex';
import { createMapScene } from '../render/createMapScene';

export function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [hexSobMouse, setHexSobMouse] = useState<CoordHex | null>(null);

  useEffect(() => createMapScene(mapRef.current!, { aoMudarHexSobMouse: setHexSobMouse }), []);

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>KeikowVTT</h1>
        <p>A paleta de tiles aparecerá aqui.</p>
        <dl className="ajuda">
          <dt>Zoom</dt>
          <dd>Roda do mouse</dd>
          <dt>Mover o mapa</dt>
          <dd>Arrastar com o botão direito ou o do meio</dd>
        </dl>
        <p className="coordenada">
          {hexSobMouse ? `Hex: q ${hexSobMouse.q}, r ${hexSobMouse.r}` : 'Hex: —'}
        </p>
      </aside>
      <main className="map" ref={mapRef} />
    </div>
  );
}
