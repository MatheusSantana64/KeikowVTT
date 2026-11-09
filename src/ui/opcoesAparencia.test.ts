import { describe, expect, it } from 'vitest';
import { fundoDaOpcao, OPCOES_APARENCIA, opcaoDoFundo } from './opcoesAparencia';

describe('opções de aparência', () => {
  it.each(OPCOES_APARENCIA.map((opcao) => opcao.id))('%s vai e volta sem mudar', (id) => {
    expect(opcaoDoFundo(fundoDaOpcao(id, 'hexHills00'))).toBe(id);
  });

  it('"Outro tile" usa o tile escolhido', () => {
    expect(fundoDaOpcao('tile', 'hexHills00')).toEqual({ tipo: 'tile', assetId: 'hexHills00' });
  });

  it('escolher o void na lista de tiles marca a opção do void', () => {
    expect(opcaoDoFundo({ tipo: 'tile', assetId: 'hexVoid00' })).toBe('void');
  });

  it('o tile base é tratado como um tile qualquer', () => {
    expect(opcaoDoFundo({ tipo: 'tile', assetId: 'hexBase00' })).toBe('tile');
  });
});
