import { describe, expect, it, vi } from 'vitest';
import { hexParaMundo } from '../core/hex';
import { criarLojaMapa } from '../core/loja';
import { hexEm } from '../core/mapa';
import type { Asset, Manifesto } from '../core/manifesto';
import { criarControlador, type Ferramenta } from './controladorFerramentas';

function asset(id: string, tipo: Asset['tipo']): Asset {
  return { id, tipo, categoria: 'c', arquivo: '', largura: 1, altura: 1, escala: 1, ancora: { x: 0, y: 0 } };
}

const manifesto: Manifesto = {
  categorias: [{ id: 'c', nome: 'C' }],
  assets: [asset('tile', 'tile'), asset('rio', 'sobreposicao'), asset('casa', 'decoracao')],
};

const A = { q: 0, r: 0 };
const B = { q: 1, r: 0 };
const centroB = hexParaMundo(B);

function montar() {
  const loja = criarLojaMapa();
  const cena = {
    mostrarPrevia: vi.fn(),
    mostrarPreviaDecoracao: vi.fn(),
    limparPrevia: vi.fn(),
    decoracaoEm: vi.fn().mockReturnValue(null),
    moverDecoracaoVisual: vi.fn(),
    sincronizarDecoracoes: vi.fn(),
  };
  const aoSelecionarHex = vi.fn();
  const controlador = criarControlador(loja, manifesto, () => cena, aoSelecionarHex);
  const usar = (ferramenta: Ferramenta) => controlador.definirFerramenta(ferramenta);
  const colocarTerreno = () => {
    loja.despachar({ tipo: 'ColocarTile', coord: A, terreno: 'tile' });
    loja.despachar({ tipo: 'ColocarTile', coord: B, terreno: 'tile' });
  };
  const decoracoes = (coord = A) => hexEm(loja.obterEstado(), coord)?.decoracoes ?? [];
  return { loja, cena, controlador, usar, colocarTerreno, decoracoes, aoSelecionarHex };
}

describe('selecionar hex', () => {
  it('sem ferramenta, um clique seleciona o hex do ponto', () => {
    const { controlador, aoSelecionarHex } = montar();
    controlador.aoClicar(centroB);
    expect(aoSelecionarHex).toHaveBeenCalledExactlyOnceWith(B);
  });

  it('com uma ferramenta ativa, o clique não seleciona', () => {
    const { controlador, usar, aoSelecionarHex } = montar();
    usar({ tipo: 'colocar', assetId: 'tile' });
    controlador.aoClicar(centroB);
    usar({ tipo: 'apagar' });
    controlador.aoClicar(centroB);
    expect(aoSelecionarHex).not.toHaveBeenCalled();
  });

  it('clicar em uma decoração seleciona o hex sem movê-la', () => {
    const { loja, cena, controlador, colocarTerreno, decoracoes, aoSelecionarHex } = montar();
    colocarTerreno();
    controlador.colocarAsset('casa', { x: 5, y: 5 });
    cena.decoracaoEm.mockReturnValue({
      decoracaoId: decoracoes()[0].id,
      assetId: 'casa',
      coord: A,
      posicao: { x: 5, y: 5 },
    });
    const antes = loja.obterEstado();
    controlador.aoIniciarTraco({ x: 5, y: 5 });
    controlador.aoTerminarTraco();
    controlador.aoClicar({ x: 5, y: 5 });
    expect(loja.obterEstado()).toBe(antes);
    expect(aoSelecionarHex).toHaveBeenCalledExactlyOnceWith(A);
  });
});

describe('colocar decorações', () => {
  it('uma decoração fica onde foi clicada', () => {
    const { controlador, usar, colocarTerreno, decoracoes } = montar();
    colocarTerreno();
    usar({ tipo: 'colocar', assetId: 'casa' });
    controlador.aoIniciarTraco({ x: 30, y: -20 });
    controlador.aoTerminarTraco();
    expect(decoracoes()).toMatchObject([{ assetId: 'casa', deslocamento: { x: 30, y: -20 } }]);
  });

  it('um rio encaixa no centro do hex', () => {
    const { controlador, usar, colocarTerreno, decoracoes } = montar();
    colocarTerreno();
    usar({ tipo: 'colocar', assetId: 'rio' });
    controlador.aoIniciarTraco({ x: 30, y: -20 });
    controlador.aoTerminarTraco();
    expect(decoracoes()).toMatchObject([{ assetId: 'rio', deslocamento: { x: 0, y: 0 } }]);
  });

  it('não repete o mesmo rio no mesmo hex, mas aceita rios diferentes', () => {
    const { controlador, colocarTerreno, decoracoes } = montar();
    colocarTerreno();
    controlador.colocarAsset('rio', { x: 0, y: 0 });
    controlador.colocarAsset('rio', { x: 10, y: 10 });
    expect(decoracoes()).toHaveLength(1);
  });

  it('cada decoração recebe um id próprio', () => {
    const { controlador, colocarTerreno, decoracoes } = montar();
    colocarTerreno();
    controlador.colocarAsset('casa', { x: 0, y: 0 });
    controlador.colocarAsset('casa', { x: 10, y: 10 });
    const [primeira, segunda] = decoracoes();
    expect(primeira.id).not.toBe(segunda.id);
  });

  it('arrastar com uma decoração selecionada não espalha cópias', () => {
    const { controlador, usar, colocarTerreno, decoracoes } = montar();
    colocarTerreno();
    usar({ tipo: 'colocar', assetId: 'casa' });
    controlador.aoIniciarTraco({ x: 0, y: 0 });
    controlador.aoContinuarTraco(B);
    controlador.aoMoverDuranteTraco(centroB);
    controlador.aoTerminarTraco();
    expect(decoracoes()).toHaveLength(1);
    expect(decoracoes(B)).toHaveLength(0);
  });

  it('não mostra prévia de decoração em hex vazio', () => {
    const { cena, controlador, usar } = montar();
    usar({ tipo: 'colocar', assetId: 'casa' });
    controlador.aoMoverPonteiro({ x: 0, y: 0 });
    expect(cena.mostrarPreviaDecoracao).not.toHaveBeenCalled();
  });
});

describe('pintar tiles', () => {
  it('uma pincelada pinta vários hexes e é desfeita de uma vez', () => {
    const { loja, controlador, usar } = montar();
    usar({ tipo: 'colocar', assetId: 'tile' });
    controlador.aoIniciarTraco({ x: 0, y: 0 });
    controlador.aoContinuarTraco(B);
    controlador.aoTerminarTraco();
    expect(hexEm(loja.obterEstado(), B)).toBeDefined();
    loja.desfazer();
    expect(loja.podeDesfazer()).toBe(false);
  });
});

describe('borracha', () => {
  const casaEm = (x: number) => ({
    decoracaoId: 'd1',
    assetId: 'casa',
    coord: A,
    posicao: { x, y: 0 },
  });

  function comCasa() {
    const montado = montar();
    montado.colocarTerreno();
    montado.controlador.colocarAsset('casa', { x: 5, y: 5 });
    const id = montado.decoracoes()[0].id;
    montado.cena.decoracaoEm.mockReturnValue({ ...casaEm(5), decoracaoId: id });
    montado.usar({ tipo: 'apagar' });
    return montado;
  }

  it('começar sobre uma decoração apaga só ela', () => {
    const { loja, controlador, decoracoes } = comCasa();
    controlador.aoIniciarTraco({ x: 5, y: 5 });
    controlador.aoTerminarTraco();
    expect(decoracoes()).toEqual([]);
    expect(hexEm(loja.obterEstado(), A)).toBeDefined();
  });

  it('um traço que começou em decoração não apaga hexes', () => {
    const { loja, controlador } = comCasa();
    controlador.aoIniciarTraco({ x: 5, y: 5 });
    controlador.aoContinuarTraco(B);
    controlador.aoTerminarTraco();
    expect(hexEm(loja.obterEstado(), B)).toBeDefined();
  });

  it('começar em lugar sem decoração apaga os hexes do traço', () => {
    const { loja, cena, controlador } = comCasa();
    cena.decoracaoEm.mockReturnValue(null);
    controlador.aoIniciarTraco({ x: 5, y: 5 });
    controlador.aoContinuarTraco(B);
    controlador.aoTerminarTraco();
    expect(hexEm(loja.obterEstado(), A)).toBeUndefined();
    expect(hexEm(loja.obterEstado(), B)).toBeUndefined();
  });
});

describe('mover decorações', () => {
  function comCasa() {
    const montado = montar();
    montado.colocarTerreno();
    montado.controlador.colocarAsset('casa', { x: 5, y: 5 });
    const decoracaoId = montado.decoracoes()[0].id;
    montado.cena.decoracaoEm.mockReturnValue({
      decoracaoId,
      assetId: 'casa',
      coord: A,
      posicao: { x: 5, y: 5 },
    });
    return { ...montado, decoracaoId };
  }

  it('leva a decoração para outro hex, mantendo a distância do agarre', () => {
    const { controlador, decoracoes } = comCasa();
    controlador.aoIniciarTraco({ x: 15, y: 5 });
    controlador.aoMoverDuranteTraco({ x: centroB.x + 10, y: centroB.y });
    controlador.aoTerminarTraco();
    expect(decoracoes(A)).toEqual([]);
    expect(decoracoes(B)).toMatchObject([{ deslocamento: { x: 0, y: 0 } }]);
  });

  it('um clique sem arrastar não muda nada', () => {
    const { loja, controlador } = comCasa();
    const antes = loja.obterEstado();
    controlador.aoIniciarTraco({ x: 5, y: 5 });
    controlador.aoTerminarTraco();
    expect(loja.obterEstado()).toBe(antes);
  });

  it('soltar em hex vazio devolve o desenho para o lugar', () => {
    const { cena, controlador, decoracoes } = comCasa();
    controlador.aoIniciarTraco({ x: 5, y: 5 });
    controlador.aoMoverDuranteTraco({ x: 5000, y: 5000 });
    controlador.aoTerminarTraco();
    expect(decoracoes(A)).toHaveLength(1);
    expect(cena.sincronizarDecoracoes).toHaveBeenCalled();
  });
});
