import { describe, expect, it, vi } from 'vitest';
import { criarLojaMapa } from './loja';
import { hexEm, type AcaoMapa } from './mapa';

const A = { q: 0, r: 0 };
const colocar: AcaoMapa = { tipo: 'ColocarTile', coord: A, terreno: 'hexPlains00' };

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
