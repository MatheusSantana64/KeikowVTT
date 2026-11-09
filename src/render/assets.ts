import { Assets, Sprite, Texture, TextureSource } from 'pixi.js';
import type { Asset, Manifesto } from '../core/manifesto';

export interface Catalogo {
  readonly assets: ReadonlyMap<string, Asset>;
  readonly texturas: ReadonlyMap<string, Texture>;
}

const PASTA_ASSETS = `${import.meta.env.BASE_URL}assets/`;

export function urlDoAsset(asset: Asset): string {
  return `${PASTA_ASSETS}${asset.arquivo}`;
}

export async function carregarManifesto(): Promise<Manifesto> {
  const resposta = await fetch(`${PASTA_ASSETS}manifesto.json`);
  if (!resposta.ok) {
    throw new Error(`Não foi possível carregar o manifesto (HTTP ${resposta.status}).`);
  }
  return (await resposta.json()) as Manifesto;
}

export async function carregarCatalogo(manifesto: Manifesto): Promise<Catalogo> {
  // Mipmaps evitam que os tiles fiquem serrilhados com o zoom afastado.
  TextureSource.defaultOptions.autoGenerateMipmaps = true;

  const texturas = await Promise.all(
    manifesto.assets.map(async (asset) => {
      const textura = await Assets.load<Texture>(urlDoAsset(asset));
      return [asset.id, textura] as const;
    }),
  );

  return {
    assets: new Map(manifesto.assets.map((asset) => [asset.id, asset])),
    texturas: new Map(texturas),
  };
}

/** Cria o sprite de um asset com o ponto de encaixe e a escala certos. */
export function criarSpriteDoAsset(catalogo: Catalogo, assetId: string): Sprite | null {
  const asset = catalogo.assets.get(assetId);
  const textura = catalogo.texturas.get(assetId);
  if (!asset || !textura) {
    console.warn(`Asset não encontrado no manifesto: ${assetId}`);
    return null;
  }
  const sprite = new Sprite(textura);
  sprite.anchor.set(asset.ancora.x / asset.largura, asset.ancora.y / asset.altura);
  sprite.scale.set(asset.escala);
  return sprite;
}
