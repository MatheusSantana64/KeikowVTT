import { describe, expect, it } from 'vitest';
import { chaveHex, coordDaChave, hexParaMundo, mundoParaHex, pontaInferiorHex } from './hex';

describe('pontaInferiorHex', () => {
  it('fica 128 px abaixo do centro', () => {
    expect(pontaInferiorHex({ q: 0, r: 1 })).toEqual({ x: 128, y: 320 });
  });
});

describe('chaves de hex', () => {
  it('ida e volta preserva a coordenada, inclusive negativa', () => {
    const coord = { q: -3, r: 12 };
    expect(coordDaChave(chaveHex(coord))).toEqual(coord);
  });
});

describe('hexParaMundo', () => {
  it('usa colunas de 256 px e linhas de 192 px', () => {
    expect(hexParaMundo({ q: 0, r: 0 })).toEqual({ x: 0, y: 0 });
    expect(hexParaMundo({ q: 1, r: 0 })).toEqual({ x: 256, y: 0 });
    expect(hexParaMundo({ q: 0, r: 2 })).toEqual({ x: 256, y: 384 });
  });

  it('desloca linhas alternadas em 128 px', () => {
    expect(hexParaMundo({ q: 0, r: 1 })).toEqual({ x: 128, y: 192 });
  });
});

describe('mundoParaHex', () => {
  it('o centro de cada hex volta para o próprio hex', () => {
    for (let q = -8; q <= 8; q++) {
      for (let r = -8; r <= 8; r++) {
        expect(mundoParaHex(hexParaMundo({ q, r }))).toEqual({ q, r });
      }
    }
  });

  it('separa vizinhos na borda vertical', () => {
    expect(mundoParaHex({ x: 127, y: 0 })).toEqual({ q: 0, r: 0 });
    expect(mundoParaHex({ x: 129, y: 0 })).toEqual({ q: 1, r: 0 });
  });

  it('separa vizinhos na borda inclinada', () => {
    // A borda superior direita de (0,0) passa pelo ponto (64, -96).
    expect(mundoParaHex({ x: 64, y: -95 })).toEqual({ q: 0, r: 0 });
    expect(mundoParaHex({ x: 64, y: -97 })).toEqual({ q: 1, r: -1 });
  });

  it('funciona ao redor de um hex longe da origem', () => {
    const centro = hexParaMundo({ q: -5, r: 7 });
    expect(mundoParaHex({ x: centro.x + 100, y: centro.y + 40 })).toEqual({ q: -5, r: 7 });
  });
});
