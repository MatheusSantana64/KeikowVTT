import { describe, expect, it, vi } from 'vitest';
import { criarLojaMapa, LIMITE_HISTORICO } from './loja';
import { criarMapaVazio, hexEm, type AcaoMapa } from './mapa';

const A = { q: 0, r: 0 };
const B = { q: 1, r: 0 };
const colocar: AcaoMapa = { tipo: 'ColocarTile', coord: A, terreno: 'hexPlains00' };
const colocarEmB: AcaoMapa = { tipo: 'ColocarTile', coord: B, terreno: 'hexHills00' };

describe('grupos de edição', () => {
  const nome = (texto: string): AcaoMapa => ({
    tipo: 'EditarInformacaoHex',
    coord: A,
    campos: { nome: texto },
  });

  function comTerreno() {
    const loja = criarLojaMapa();
    loja.despachar(colocar);
    return loja;
  }

  it('ações seguidas do mesmo grupo são desfeitas de uma vez', () => {
    const loja = comTerreno();
    loja.despachar(nome('V'), 'g1');
    loja.despachar(nome('Va'), 'g1');
    loja.despachar(nome('Vau'), 'g1');
    loja.desfazer();
    expect(hexEm(loja.obterEstado(), A)?.nome).toBe('');
  });

  it('grupos diferentes são passos diferentes', () => {
    const loja = comTerreno();
    loja.despachar(nome('Vau'), 'g1');
    loja.despachar(nome('Ponte'), 'g2');
    loja.desfazer();
    expect(hexEm(loja.obterEstado(), A)?.nome).toBe('Vau');
  });

  it('uma ação sem grupo no meio separa os passos', () => {
    const loja = comTerreno();
    loja.despachar(nome('Vau'), 'g1');
    loja.despachar(colocarEmB);
    loja.despachar(nome('Ponte'), 'g1');
    loja.desfazer();
    expect(hexEm(loja.obterEstado(), A)?.nome).toBe('Vau');
    expect(hexEm(loja.obterEstado(), B)).toBeDefined();
  });

  it('depois de desfazer, o mesmo grupo começa um novo passo', () => {
    const loja = comTerreno();
    loja.despachar(nome('Vau'), 'g1');
    loja.desfazer();
    loja.despachar(nome('Ponte'), 'g1');
    loja.desfazer();
    expect(hexEm(loja.obterEstado(), A)?.nome).toBe('');
    expect(loja.podeDesfazer()).toBe(true);
  });

  it('uma pincelada logo depois de um grupo continua sendo um único passo', () => {
    const loja = comTerreno();
    loja.despachar(nome('Vau'), 'g1');
    loja.iniciarTraco();
    loja.despachar(colocarEmB);
    loja.despachar({ tipo: 'ColocarTile', coord: { q: 2, r: 0 }, terreno: 't' });
    loja.terminarTraco();
    loja.desfazer();
    expect(hexEm(loja.obterEstado(), B)).toBeUndefined();
    expect(hexEm(loja.obterEstado(), A)?.nome).toBe('Vau');
  });
});

describe('desfazer e refazer', () => {
  it('desfaz e refaz uma ação', () => {
    const loja = criarLojaMapa();
    loja.despachar(colocar);
    const depois = loja.obterEstado();
    loja.desfazer();
    expect(loja.obterEstado()).toEqual(criarMapaVazio());
    loja.refazer();
    expect(loja.obterEstado()).toBe(depois);
  });

  it('avisa os ouvintes ao desfazer', () => {
    const loja = criarLojaMapa();
    loja.despachar(colocar);
    const ouvinte = vi.fn();
    loja.assinar(ouvinte);
    loja.desfazer();
    expect(ouvinte).toHaveBeenCalledExactlyOnceWith(loja.obterEstado());
  });

  it('não faz nada sem histórico', () => {
    const loja = criarLojaMapa();
    const ouvinte = vi.fn();
    loja.assinar(ouvinte);
    loja.desfazer();
    loja.refazer();
    expect(ouvinte).not.toHaveBeenCalled();
    expect(loja.podeDesfazer()).toBe(false);
    expect(loja.podeRefazer()).toBe(false);
  });

  it('uma ação nova apaga o que podia ser refeito', () => {
    const loja = criarLojaMapa();
    loja.despachar(colocar);
    loja.desfazer();
    expect(loja.podeRefazer()).toBe(true);
    loja.despachar(colocarEmB);
    expect(loja.podeRefazer()).toBe(false);
  });

  it('uma ação sem efeito não entra no histórico nem apaga o refazer', () => {
    const loja = criarLojaMapa();
    loja.despachar(colocar);
    loja.despachar(colocarEmB);
    loja.desfazer();
    loja.despachar(colocar);
    expect(loja.podeRefazer()).toBe(true);
  });

  it('um traço inteiro é desfeito de uma vez', () => {
    const loja = criarLojaMapa();
    loja.iniciarTraco();
    loja.despachar(colocar);
    loja.despachar(colocarEmB);
    loja.terminarTraco();
    loja.desfazer();
    expect(loja.obterEstado()).toEqual(criarMapaVazio());
    expect(loja.podeDesfazer()).toBe(false);
  });

  it('dois traços são dois passos', () => {
    const loja = criarLojaMapa();
    loja.iniciarTraco();
    loja.despachar(colocar);
    loja.terminarTraco();
    loja.iniciarTraco();
    loja.despachar(colocarEmB);
    loja.terminarTraco();
    loja.desfazer();
    expect(hexEm(loja.obterEstado(), A)).toBeDefined();
    expect(hexEm(loja.obterEstado(), B)).toBeUndefined();
  });

  it('um traço que não mudou nada não cria passo', () => {
    const loja = criarLojaMapa();
    loja.iniciarTraco();
    loja.terminarTraco();
    expect(loja.podeDesfazer()).toBe(false);
  });

  it('desfazer no meio de um traço não perde o histórico', () => {
    const loja = criarLojaMapa();
    loja.iniciarTraco();
    loja.despachar(colocar);
    loja.desfazer();
    loja.despachar(colocarEmB);
    loja.desfazer();
    expect(loja.obterEstado()).toEqual(criarMapaVazio());
  });

  it('limita o tamanho do histórico', () => {
    const loja = criarLojaMapa();
    for (let q = 0; q < LIMITE_HISTORICO + 10; q++) {
      loja.despachar({ tipo: 'ColocarTile', coord: { q, r: 0 }, terreno: 'hexPlains00' });
    }
    for (let i = 0; i < LIMITE_HISTORICO; i++) {
      loja.desfazer();
    }
    expect(loja.podeDesfazer()).toBe(false);
    expect(Object.keys(loja.obterEstado().hexes)).toHaveLength(10);
  });
});

describe('criarLojaMapa', () => {
  it('aplica as ações ao estado', () => {
    const loja = criarLojaMapa();
    loja.despachar(colocar);
    expect(hexEm(loja.obterEstado(), A)?.terreno).toBe('hexPlains00');
  });

  it('avisa quem assinou, com o novo estado', () => {
    const loja = criarLojaMapa();
    const ouvinte = vi.fn();
    loja.assinar(ouvinte);
    loja.despachar(colocar);
    expect(ouvinte).toHaveBeenCalledExactlyOnceWith(loja.obterEstado());
  });

  it('não avisa quando a ação não muda nada', () => {
    const loja = criarLojaMapa();
    loja.despachar(colocar);
    const ouvinte = vi.fn();
    loja.assinar(ouvinte);
    loja.despachar(colocar);
    expect(ouvinte).not.toHaveBeenCalled();
  });

  it('para de avisar depois de cancelar', () => {
    const loja = criarLojaMapa();
    const ouvinte = vi.fn();
    const cancelar = loja.assinar(ouvinte);
    cancelar();
    loja.despachar(colocar);
    expect(ouvinte).not.toHaveBeenCalled();
  });
});
