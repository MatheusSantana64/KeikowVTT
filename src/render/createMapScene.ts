import { Application } from 'pixi.js';
import { carregarAssets } from './assets';
import { desenharGaleria } from './galeriaAssets';

/**
 * Cria a cena do mapa dentro de `container` e devolve uma função que a destrói.
 * A inicialização é assíncrona, então a cena pode ser destruída antes de ficar pronta.
 */
export function createMapScene(container: HTMLElement): () => void {
  const app = new Application();
  let ready = false;
  let disposed = false;

  const iniciar = async () => {
    await app.init({
      resizeTo: container,
      background: '#14161c',
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    if (disposed) {
      app.destroy(true);
      return;
    }
    ready = true;
    container.appendChild(app.canvas);

    const assets = await carregarAssets();
    if (!disposed) {
      desenharGaleria(app, assets);
    }
  };
  void iniciar();

  return () => {
    disposed = true;
    if (ready) {
      app.destroy(true);
    }
  };
}
