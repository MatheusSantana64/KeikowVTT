import { hexParaMundo, mundoParaHex, type CoordHex, type PontoMundo } from '../core/hex';
import type { LojaMapa } from '../core/loja';
import { hexEm } from '../core/mapa';
import type { Manifesto } from '../core/manifesto';
import type { CenaMapa } from '../render/createMapScene';

export type Ferramenta =
  | { readonly tipo: 'nenhuma' }
  | { readonly tipo: 'colocar'; readonly assetId: string }
  | { readonly tipo: 'apagar' };

export const SEM_FERRAMENTA: Ferramenta = { tipo: 'nenhuma' };

type CenaControlada = Pick<
  CenaMapa,
  | 'mostrarPrevia'
  | 'mostrarPreviaDecoracao'
  | 'limparPrevia'
  | 'decoracaoEm'
  | 'moverDecoracaoVisual'
  | 'sincronizarDecoracoes'
>;

interface Movimento {
  readonly decoracaoId: string;
  readonly assetId: string;
  readonly origem: CoordHex;
  /** Distância entre o mouse e o centro da decoração, para ela não "pular" ao ser agarrada. */
  readonly agarre: PontoMundo;
  posicao: PontoMundo | null;
}

/** Traduz o que o mouse faz no mapa em ações, de acordo com a ferramenta atual. */
export function criarControlador(
  loja: LojaMapa,
  manifesto: Manifesto,
  obterCena: () => CenaControlada | null,
) {
  const assets = new Map(manifesto.assets.map((asset) => [asset.id, asset]));
  let ferramenta: Ferramenta = SEM_FERRAMENTA;
  let movimento: Movimento | null = null;
  let apagandoDecoracoes = false;

  const ehTile = (assetId: string) => assets.get(assetId)?.tipo === 'tile';
  const ehSobreposicao = (assetId: string) => assets.get(assetId)?.tipo === 'sobreposicao';

  const temSobreposicao = (coord: CoordHex, assetId: string) =>
    hexEm(loja.obterEstado(), coord)?.decoracoes.some((d) => d.assetId === assetId) ?? false;

  /** Rios encaixam no centro do hex; as demais decorações ficam onde foram soltas. */
  const posicaoFinal = (assetId: string, ponto: PontoMundo): PontoMundo =>
    ehSobreposicao(assetId) ? hexParaMundo(mundoParaHex(ponto)) : ponto;

  const deslocamentoEm = (coord: CoordHex, posicao: PontoMundo): PontoMundo => {
    const centro = hexParaMundo(coord);
    return { x: posicao.x - centro.x, y: posicao.y - centro.y };
  };

  const colocarAsset = (assetId: string, ponto: PontoMundo) => {
    const posicao = posicaoFinal(assetId, ponto);
    const coord = mundoParaHex(posicao);
    if (ehTile(assetId)) {
      loja.despachar({ tipo: 'ColocarTile', coord, terreno: assetId });
      return;
    }
    if (ehSobreposicao(assetId) && temSobreposicao(coord, assetId)) {
      return;
    }
    loja.despachar({
      tipo: 'ColocarDecoracao',
      coord,
      decoracao: {
        // O id vai dentro da ação para que repetir as ações produza sempre o mesmo mapa.
        id: crypto.randomUUID(),
        assetId,
        deslocamento: deslocamentoEm(coord, posicao),
      },
    });
  };

  const mostrarPrevia = (assetId: string, ponto: PontoMundo) => {
    const cena = obterCena();
    const posicao = posicaoFinal(assetId, ponto);
    const coord = mundoParaHex(posicao);
    if (ehTile(assetId)) {
      cena?.mostrarPrevia(assetId, coord);
    } else if (hexEm(loja.obterEstado(), coord)) {
      cena?.mostrarPreviaDecoracao(assetId, posicao);
    } else {
      // Decorações precisam de um hex com terreno.
      cena?.limparPrevia();
    }
  };

  const apagarDecoracaoEm = (ponto: PontoMundo): boolean => {
    const encontrada = obterCena()?.decoracaoEm(ponto);
    if (encontrada) {
      loja.despachar({
        tipo: 'RemoverDecoracao',
        coord: encontrada.coord,
        decoracaoId: encontrada.decoracaoId,
      });
    }
    return Boolean(encontrada);
  };

  const iniciarMovimento = (ponto: PontoMundo) => {
    const encontrada = obterCena()?.decoracaoEm(ponto);
    if (encontrada) {
      movimento = {
        decoracaoId: encontrada.decoracaoId,
        assetId: encontrada.assetId,
        origem: encontrada.coord,
        agarre: { x: encontrada.posicao.x - ponto.x, y: encontrada.posicao.y - ponto.y },
        posicao: null,
      };
    }
  };

  const concluirMovimento = ({ assetId, decoracaoId, origem, posicao }: Movimento) => {
    if (posicao) {
      const destino = mundoParaHex(posicao);
      const mesmoHex = destino.q === origem.q && destino.r === origem.r;
      if (mesmoHex || !ehSobreposicao(assetId) || !temSobreposicao(destino, assetId)) {
        loja.despachar({
          tipo: 'MoverDecoracao',
          origem,
          decoracaoId,
          destino,
          deslocamento: deslocamentoEm(destino, posicao),
        });
      }
    }
    // Se o movimento foi recusado, a decoração volta para o lugar.
    obterCena()?.sincronizarDecoracoes();
  };

  return {
    definirFerramenta(nova: Ferramenta) {
      ferramenta = nova;
      obterCena()?.limparPrevia();
    },

    colocarAsset,
    mostrarPrevia,

    aoMoverPonteiro(ponto: PontoMundo | null) {
      if (ponto && ferramenta.tipo === 'colocar') {
        mostrarPrevia(ferramenta.assetId, ponto);
      } else {
        obterCena()?.limparPrevia();
      }
    },

    aoIniciarTraco(ponto: PontoMundo) {
      if (ferramenta.tipo === 'nenhuma') {
        iniciarMovimento(ponto);
      } else if (ferramenta.tipo === 'apagar') {
        loja.iniciarTraco();
        apagandoDecoracoes = apagarDecoracaoEm(ponto);
        if (!apagandoDecoracoes) {
          loja.despachar({ tipo: 'RemoverTile', coord: mundoParaHex(ponto) });
        }
      } else if (ehTile(ferramenta.assetId)) {
        loja.iniciarTraco();
        colocarAsset(ferramenta.assetId, ponto);
      } else {
        colocarAsset(ferramenta.assetId, ponto);
      }
    },

    aoContinuarTraco(coord: CoordHex) {
      if (ferramenta.tipo === 'colocar' && ehTile(ferramenta.assetId)) {
        loja.despachar({ tipo: 'ColocarTile', coord, terreno: ferramenta.assetId });
      } else if (ferramenta.tipo === 'apagar' && !apagandoDecoracoes) {
        loja.despachar({ tipo: 'RemoverTile', coord });
      }
    },

    aoMoverDuranteTraco(ponto: PontoMundo) {
      if (movimento) {
        movimento.posicao = posicaoFinal(movimento.assetId, {
          x: ponto.x + movimento.agarre.x,
          y: ponto.y + movimento.agarre.y,
        });
        obterCena()?.moverDecoracaoVisual(movimento.decoracaoId, movimento.posicao);
      } else if (ferramenta.tipo === 'apagar' && apagandoDecoracoes) {
        apagarDecoracaoEm(ponto);
      }
    },

    aoTerminarTraco() {
      if (movimento) {
        concluirMovimento(movimento);
        movimento = null;
      }
      apagandoDecoracoes = false;
      loja.terminarTraco();
    },
  };
}
