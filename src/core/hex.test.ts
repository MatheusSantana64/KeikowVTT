import { describe, expect, it } from 'vitest';
import {
  chaveHex,
  contornoHex,
  coordDaChave,
  hexesNaArea,
  hexParaMundo,
  linhaHex,
  mundoParaHex,
  pontaInferiorHex,
} from './hex';

describe('linhaHex', () => {
  it('um hex só devolve ele mesmo', () => {
    expect(linhaHex({ q: 3, r: -1 }, { q: 3, r: -1 })).toEqual([{ q: 3, r: -1 }]);
  });

  it('percorre uma linha reta', () => {
    expect(linhaHex({ q: 0, r: 0 }, { q: 3, r: 0 })).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 },
      { q: 3, r: 0 },
    ]);
  });

  it('começa e termina nos hexes pedidos, sempre passando por vizinhos', () => {
    const inicio = { q: -4, r: 7 };
    const fim = { q: 5, r: -3 };
    const linha = linhaHex(inicio, fim);
    expect(linha[0]).toEqual(inicio);
    expect(linha[linha.length - 1]).toEqual(fim);
    for (let i = 1; i < linha.length; i++) {
      const dq = linha[i].q - linha[i - 1].q;
      const dr = linha[i].r - linha[i - 1].r;
      expect(Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr))).toBe(1);
    }
  });
});

describe('contornoHex', () => {
  it('tem os seis cantos com ponta para cima', () => {
    expect(contornoHex({ q: 0, r: 0 })).toEqual([
      0, -128, 128, -64, 128, 64, 0, 128, -128, 64, -128, -64,
    ]);
  });

  it('pontos logo dentro de cada canto pertencem ao próprio hex', () => {
    const coord = { q: 2, r: -3 };
    const centro = hexParaMundo(coord);
    const contorno = contornoHex(coord);
    for (let i = 0; i < contorno.length; i += 2) {
      const ponto = {
        x: centro.x + (contorno[i] - centro.x) * 0.95,
        y: centro.y + (contorno[i + 1] - centro.y) * 0.95,
      };
      expect(mundoParaHex(ponto)).toEqual(coord);
    }
  });
});

describe('hexesNaArea', () => {
  it('inclui todo hex que tem um ponto dentro da área', () => {
    const area = { minX: -700, minY: -450, maxX: 900, maxY: 650 };
    const chaves = new Set(hexesNaArea(area).map(chaveHex));
    for (let x = area.minX; x <= area.maxX; x += 37) {
      for (let y = area.minY; y <= area.maxY; y += 37) {
        expect(chaves.has(chaveHex(mundoParaHex({ x, y })))).toBe(true);
      }
    }
  });

  it('não devolve muito mais hexes do que cabem na área', () => {
    // A área tem cerca de 4 × 4 hexes; a folga cobre as bordas parcialmente visíveis.
    expect(hexesNaArea({ minX: 0, minY: 0, maxX: 1024, maxY: 768 }).length).toBeLessThan(64);
  });
});

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
