import { Assets, Texture } from 'pixi.js';
import type { Manifesto } from '../core/manifesto';

export interface AssetsCarregados {
  readonly manifesto: Manifesto;
  readonly texturas: ReadonlyMap<string, Texture>;
}

const PASTA_ASSETS = `${import.meta.env.BASE_URL}assets/`;

export async function carregarAssets(): Promise<AssetsCarregados> {
  const resposta = await fetch(`${PASTA_ASSETS}manifesto.json`);
  if (!resposta.ok) {
    throw new Error(`Não foi possível carregar o manifesto (HTTP ${resposta.status}).`);
  }
  const manifesto = (await resposta.json()) as Manifesto;

  const texturas = await Promise.all(
    manifesto.assets.map(async (asset) => {
      const textura = await Assets.load<Texture>(`${PASTA_ASSETS}${asset.arquivo}`);
      return [asset.id, textura] as const;
    }),
  );

  return { manifesto, texturas: new Map(texturas) };
}
