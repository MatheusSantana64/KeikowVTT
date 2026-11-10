import { describe, expect, it } from 'vitest';
import { NOME_NIVEL_DA_CLASSE, problemaNaFormula } from './regras';
import { REGRAS_PADRAO } from './regrasPadrao';

const daClasse = { extras: [NOME_NIVEL_DA_CLASSE], colunas: new Set(['furias']), dados: 'proibidos' } as const;

describe('problemaNaFormula', () => {
  it('aceita fórmulas com nomes das regras, mod e colunas da classe', () => {
    expect(problemaNaFormula(REGRAS_PADRAO, 'tabela(furias) + mod(CAR) + prof', daClasse)).toBeNull();
    expect(problemaNaFormula(REGRAS_PADRAO, 'nivel_classe * 5', daClasse)).toBeNull();
  });

  it('aponta o primeiro problema', () => {
    expect(problemaNaFormula(REGRAS_PADRAO, '1 +', daClasse)).toContain('terminou antes');
    expect(problemaNaFormula(REGRAS_PADRAO, 'sorte', daClasse)).toBe('Nome desconhecido: "sorte".');
    expect(problemaNaFormula(REGRAS_PADRAO, 'dobro(2)', daClasse)).toBe('Função desconhecida: "dobro".');
    expect(problemaNaFormula(REGRAS_PADRAO, 'tabela(ki)', daClasse)).toBe('A tabela da classe não tem a coluna "ki".');
    expect(problemaNaFormula(REGRAS_PADRAO, '1d4', daClasse)).toBe('Esta fórmula não pode rolar dados.');
  });

  it('fora de uma classe, tabela e nivel_classe não existem', () => {
    const avulsa = { colunas: null, dados: 'permitidos' } as const;
    expect(problemaNaFormula(REGRAS_PADRAO, 'tabela(furias)', avulsa)).toContain('só funciona em fórmulas de uma classe');
    expect(problemaNaFormula(REGRAS_PADRAO, 'nivel_classe', avulsa)).toBe('Nome desconhecido: "nivel_classe".');
    expect(problemaNaFormula(REGRAS_PADRAO, '1d8 + mod(FOR)', avulsa)).toBeNull();
  });

  it('com colunas "qualquer", não confere as colunas', () => {
    expect(problemaNaFormula(REGRAS_PADRAO, 'tabela(qualquer_uma)', { colunas: 'qualquer', dados: 'proibidos' })).toBeNull();
  });
});
