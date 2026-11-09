import { useEffect, useRef } from 'react';
import { createMapScene } from '../render/createMapScene';

export function App() {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => createMapScene(mapRef.current!), []);

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>KeikowVTT</h1>
        <p>A paleta de tiles aparecerá aqui.</p>
      </aside>
      <main className="map" ref={mapRef} />
    </div>
  );
}
