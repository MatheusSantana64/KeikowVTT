import { Application, Graphics } from 'pixi.js';

/** Contorno de um hex com ponta para cima, centrado na origem (largura e altura de 256). */
const HEX_OUTLINE = [0, -128, 128, -64, 128, 64, 0, 128, -128, 64, -128, -64];

/**
 * Cria a cena do mapa dentro de `container` e devolve uma função que a destrói.
 * A inicialização do PixiJS é assíncrona, então a cena pode ser destruída antes de ficar pronta.
 */
export function createMapScene(container: HTMLElement): () => void {
  const app = new Application();
  let ready = false;
  let disposed = false;

  void app
    .init({
      resizeTo: container,
      background: '#14161c',
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    })
    .then(() => {
      if (disposed) {
        app.destroy(true);
        return;
      }
      ready = true;
      container.appendChild(app.canvas);

      const hex = new Graphics().poly(HEX_OUTLINE).stroke({ width: 2, color: 0x6f7690 });
      app.stage.addChild(hex);

      const centerHex = () => hex.position.set(app.screen.width / 2, app.screen.height / 2);
      centerHex();
      app.renderer.on('resize', centerHex);
    });

  return () => {
    disposed = true;
    if (ready) {
      app.destroy(true);
    }
  };
}
