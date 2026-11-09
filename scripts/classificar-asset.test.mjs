import { describe, expect, it } from 'vitest';
import { classificarAsset } from './classificar-asset.mjs';

describe('classificarAsset', () => {
  it('reconhece um tile no tamanho padrão', () => {
    expect(classificarAsset('hexPlains00', 256, 384)).toEqual({
      tipo: 'tile',
      escala: 1,
      ancora: { x: 128, y: 384 },
    });
  });

  it('ajusta um tile maior com a mesma proporção', () => {
    expect(classificarAsset('hexNovo00', 512, 768)).toEqual({
      tipo: 'tile',
      escala: 0.5,
      ancora: { x: 256, y: 768 },
    });
  });

  it('ajusta um tile menor com a mesma proporção', () => {
    expect(classificarAsset('hexNovo00', 128, 192).escala).toBe(2);
  });

  it('reconhece sobreposições e calcula o centro do hex', () => {
    expect(classificarAsset('hexRiver010010-00', 512, 768)).toEqual({
      tipo: 'sobreposicao',
      escala: 0.5,
      ancora: { x: 256, y: 512 },
    });
  });

  it('reconhece bases e calcula o ponto de encaixe', () => {
    expect(classificarAsset('hexUnderDirt00', 256, 192)).toEqual({
      tipo: 'base',
      escala: 1,
      ancora: { x: 128, y: 64 },
    });
  });

  it('uma imagem sem "hex" no nome é decoração, mesmo com proporção de tile', () => {
    expect(classificarAsset('estatua00', 512, 768)).toEqual({
      tipo: 'decoracao',
      escala: 1,
      ancora: { x: 256, y: 384 },
    });
  });

  it('respeita a exceção do porto', () => {
    expect(classificarAsset('hexPortCentre00', 320, 352).tipo).toBe('decoracao');
  });

  it('recusa um tile com proporção errada e diz qual é o arquivo', () => {
    expect(() => classificarAsset('hexTorto00', 300, 400)).toThrow('hexTorto00');
  });

  it('recusa uma base com proporção errada', () => {
    expect(() => classificarAsset('hexUnderNovo00', 256, 384)).toThrow('4:3');
  });
});
