import type { PontoMundo } from './hex';

export type TipoAsset = 'tile' | 'sobreposicao' | 'decoracao' | 'base';

export interface Asset {
  readonly id: string;
  readonly categoria: string;
  readonly tipo: TipoAsset;
  /** Caminho relativo à pasta de assets. */
  readonly arquivo: string;
  readonly largura: number;
  readonly altura: number;
  /** Fator aplicado ao desenhar, para que imagens de outros tamanhos caibam no hex. */
  readonly escala: number;
  /**
   * Pixel da imagem usado para posicioná-la. Em tiles e bases, é o pixel que
   * encosta na ponta inferior do hex; em sobreposições (rios), o que fica no
   * centro do hex; em decorações, é o centro da imagem.
   */
  readonly ancora: PontoMundo;
}

export interface Categoria {
  readonly id: string;
  readonly nome: string;
}

export interface Manifesto {
  readonly categorias: readonly Categoria[];
  readonly assets: readonly Asset[];
}
