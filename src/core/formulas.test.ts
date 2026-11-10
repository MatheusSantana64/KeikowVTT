import { describe, expect, it } from 'vitest';
import {
  calcularFormula,
  formatarNumero,
  lerFormula,
  LIMITE_DADOS_ROLAGEM,
  LIMITE_TEXTO,
  normalizarNome,
  rolarFormula,
  textoResolvido,
  usoDaFormula,
  type ContextoFormula,
  type FormulaLida,
} from './formulas';

function ler(texto: string): FormulaLida {
  const lido = lerFormula(texto);
  if (!lido.ok) {
    throw new Error(`Não leu "${texto}": ${lido.erro}`);
  }
  return lido.formula;
}

function erroAoLer(texto: string) {
  const lido = lerFormula(texto);
  if (lido.ok) {
    throw new Error(`Deveria recusar "${texto}"`);
  }
  return { erro: lido.erro, posicao: lido.posicao };
}

const valores: Record<string, number> = { for: 16, des: 14, con: 12, nivel: 5, prof: 3, zero: 0 };

const contexto: ContextoFormula = {
  valor: (nome) => valores[nome],
  funcao: (nome, args) => (nome === 'mod' && args.length === 1 ? Math.floor((args[0] - 10) / 2) : undefined),
};

function calcular(texto: string, ctx: ContextoFormula = contexto): number {
  const resultado = calcularFormula(ler(texto), ctx);
  if (!resultado.ok) {
    throw new Error(`Não calculou "${texto}": ${resultado.erro}`);
  }
  return resultado.valor;
}

function erroAoCalcular(texto: string, ctx: ContextoFormula = contexto): string {
  const resultado = calcularFormula(ler(texto), ctx);
  if (resultado.ok) {
    throw new Error(`Deveria falhar: "${texto}"`);
  }
  return resultado.erro;
}

/** Um "dado" previsível: devolve os valores da lista, em ordem. */
function dadosFixos(...resultados: number[]) {
  let i = 0;
  // rolarDado faz 1 + piso(aleatorio * faces); para cair em `r` num d20, aleatorio = (r - 1) / 20.
  return (faces: number) => () => (resultados[i++ % resultados.length] - 1) / faces + 0.0001;
}

function rolar(texto: string, faces: number, ...resultados: number[]) {
  const resultado = rolarFormula(ler(texto), contexto, dadosFixos(...resultados)(faces));
  if (!resultado.ok) {
    throw new Error(`Não rolou "${texto}": ${resultado.erro}`);
  }
  return resultado;
}

describe('contas', () => {
  it.each([
    ['1 + 2 * 3', 7],
    ['(1 + 2) * 3', 9],
    ['10 - 4 - 3', 3],
    ['12 / 4 / 3', 1],
    ['-3 + 5', 2],
    ['--3', 3],
    ['2 * -3', -6],
    ['+4', 4],
    ['1.5 * 2', 3],
    ['7 / 2', 3.5],
  ])('%s = %d', (texto, esperado) => {
    expect(calcular(texto)).toBe(esperado);
  });

  it('usa nomes e funções do contexto', () => {
    expect(calcular('10 + mod(DES)')).toBe(12);
    expect(calcular('mod(FOR) + prof')).toBe(6);
    expect(calcular('2 + piso((nivel - 1) / 4)')).toBe(3);
  });

  it('não diferencia maiúsculas nem acentos nos nomes', () => {
    expect(calcular('Nível + NIVEL + nivel')).toBe(15);
    expect(normalizarNome('Ação_Bônus')).toBe('acao_bonus');
  });

  it('tem min, max, piso, teto e arredondar', () => {
    expect(calcular('min(3, 1, 2)')).toBe(1);
    expect(calcular('max(mod(DES), 0)')).toBe(2);
    expect(calcular('piso(-1.5)')).toBe(-2);
    expect(calcular('teto(1.1)')).toBe(2);
    expect(calcular('arredondar(2.5)')).toBe(3);
  });

  it('compara e decide com se, e e ou', () => {
    expect(calcular('nivel >= 5')).toBe(1);
    expect(calcular('nivel > 5')).toBe(0);
    expect(calcular('nivel = 5')).toBe(1);
    expect(calcular('nivel == 5')).toBe(1);
    expect(calcular('nivel != 5')).toBe(0);
    expect(calcular('se(nivel >= 5 e FOR >= 13, 2, 1)')).toBe(2);
    expect(calcular('se(nivel > 10 ou FOR < 10, 2, 1)')).toBe(1);
  });

  it('o "se" só calcula o lado escolhido', () => {
    expect(calcular('se(1, 5, desconhecido)')).toBe(5);
    expect(calcular('zero e desconhecido')).toBe(0);
    expect(calcular('1 ou desconhecido')).toBe(1);
  });

  it('ilimitado vale infinito', () => {
    expect(calcular('ilimitado')).toBe(Infinity);
    expect(formatarNumero(Infinity)).toBe('ilimitado');
  });
});

describe('erros', () => {
  it.each([
    ['', 'vazia', 0],
    ['1 +', 'terminou antes', 3],
    ['(1 + 2', 'fechar um parêntese', 0],
    ['max(1, 2', 'parêntese de "max("', 3],
    ['1 $ 2', '"$"', 2],
    ['2 3', 'a partir de "3"', 2],
    ['1 < 2 < 3', '"e" ou "ou"', 6],
    ['e + 1', 'entre duas condições', 0],
    ['se(1, 2)', '3 valores', 0],
    ['piso()', '1 valor', 0],
    ['tabela(1 + 2)', 'nome de uma coluna', 7],
    ['1d(1d6)', 'dentro da quantidade ou das faces', 2],
  ])('recusa %j', (texto, trecho, posicao) => {
    const { erro, posicao: onde } = erroAoLer(texto);
    expect(erro).toContain(trecho);
    expect(onde).toBe(posicao);
  });

  it('recusa fórmulas longas demais e aninhadas demais', () => {
    expect(erroAoLer('1+'.repeat(LIMITE_TEXTO)).erro).toContain(`${LIMITE_TEXTO} caracteres`);
    expect(erroAoLer(`${'('.repeat(60)}1${')'.repeat(60)}`).erro).toContain('uns dentro dos outros');
  });

  it('explica nomes e funções desconhecidos, mostrando como foram escritos', () => {
    expect(erroAoCalcular('10 + Destreza')).toBe('Nome desconhecido: "Destreza".');
    expect(erroAoCalcular('Dobro(2)')).toBe('Função desconhecida: "Dobro".');
  });

  it('recusa divisão por zero e contas sem resultado', () => {
    expect(erroAoCalcular('1 / zero')).toBe('Divisão por zero.');
    expect(erroAoCalcular('ilimitado - ilimitado')).toContain('não deu um número');
  });

  it('dados só valem numa rolagem', () => {
    expect(erroAoCalcular('1d8 + 2')).toContain('só vale numa rolagem');
  });

  it('erros do contexto chegam como erros da fórmula', () => {
    expect(erroAoCalcular('tabela(furias)')).toContain('só funciona em fórmulas de uma classe');
  });
});

describe('dados', () => {
  it('reconhece as formas de escrever dados', () => {
    for (const texto of ['1d8', 'd20', '1D8', '(nivel)d6', '2d20kh1', '2D20KL1', 'prof d4']) {
      expect(usoDaFormula(ler(texto)).temDados).toBe(true);
    }
    // Nomes que começam com "d" continuam sendo nomes.
    expect(usoDaFormula(ler('dano + des')).temDados).toBe(false);
  });

  it('rola e soma, guardando cada dado', () => {
    const r = rolar('2d6 + 3', 6, 4, 5);
    expect(r.total).toBe(12);
    expect(r.dados).toEqual([{ texto: '2d6', faces: 6, valores: [4, 5], mantidos: [true, true] }]);
  });

  it('vantagem fica com o maior; desvantagem com o menor', () => {
    expect(rolar('2d20kh1', 20, 7, 15).total).toBe(15);
    expect(rolar('2d20kl1', 20, 7, 15).total).toBe(7);
    expect(rolar('4d6kh3', 6, 1, 6, 3, 1).dados[0].mantidos).toEqual([true, true, true, false]);
  });

  it('quantidade e faces podem vir de nomes', () => {
    const r = rolar('(prof)d4', 4, 2, 2, 2);
    expect(r.dados[0].texto).toBe('3d4');
    expect(r.total).toBe(6);
  });

  it('cada parte da soma aparece separada, já com o sinal', () => {
    const r = rolar('1d20 + mod(DES) - prof', 20, 11);
    expect(r.partes).toEqual([
      { texto: '1d20', valor: 11 },
      { texto: 'mod(DES)', valor: 2, nome: 'des', funcao: 'mod' },
      { texto: 'prof', valor: -3, nome: 'prof' },
    ]);
    expect(r.total).toBe(10);
  });

  it('o resultado de um dado nunca passa das faces, mesmo com um aleatório de 1', () => {
    const r = rolarFormula(ler('1d6'), contexto, () => 1);
    expect(r.ok && r.total).toBe(6);
  });

  it('limita quantidade, faces e total de dados', () => {
    const erro = (texto: string) => {
      const r = rolarFormula(ler(texto), contexto, () => 0);
      return r.ok ? '' : r.erro;
    };
    expect(erro('101d6')).toContain('de 0 a 100');
    expect(erro('1d1001')).toContain('de 1 a 1000');
    expect(erro('1.5d6')).toContain('inteiro');
    expect(erro('2d20kh3')).toContain('de 0 a 2');
    expect(erro(Array(3).fill('100d6').join(' + '))).toContain(`${LIMITE_DADOS_ROLAGEM} dados`);
  });
});

describe('explicação', () => {
  it('separa as parcelas de fora e marca nomes e funções', () => {
    const r = calcularFormula(ler('10 + mod(DES) + (prof * 2)'), contexto);
    expect(r).toEqual({
      ok: true,
      valor: 18,
      partes: [
        { texto: '10', valor: 10 },
        { texto: 'mod(DES)', valor: 2, nome: 'des', funcao: 'mod' },
        { texto: '(prof * 2)', valor: 6 },
      ],
    });
  });

  it('uma fórmula que não é soma vira uma parte só', () => {
    const r = calcularFormula(ler('max(1, 2)'), contexto);
    expect(r.ok && r.partes).toEqual([{ texto: 'max(1, 2)', valor: 2 }]);
  });
});

describe('tabela', () => {
  const colunas: Record<string, string> = {
    furias: '3',
    ataque_furtivo: '3d6',
    dobro: 'tabela(furias) * 2',
    circular: 'tabela(circular)',
    sem_fim: 'ilimitado',
  };
  const comTabela: ContextoFormula = {
    ...contexto,
    tabela: (coluna) => (coluna in colunas ? ler(colunas[coluna]) : undefined),
  };

  it('lê a coluna no nível atual', () => {
    expect(calcular('tabela(furias)', comTabela)).toBe(3);
    expect(calcular('tabela(dobro) + 1', comTabela)).toBe(7);
    expect(calcular('tabela(sem_fim)', comTabela)).toBe(Infinity);
  });

  it('coluna com dados rola junto', () => {
    const r = rolarFormula(ler('tabela(ataque_furtivo) + mod(DES)'), comTabela, () => 0.5);
    expect(r.ok && r.total).toBe(4 * 3 + 2);
  });

  it('avisa coluna que não existe e coluna que cita a si mesma', () => {
    expect(erroAoCalcular('tabela(inexistente)', comTabela)).toContain('não tem a coluna "inexistente"');
    expect(erroAoCalcular('tabela(circular)', comTabela)).toContain('em cadeia demais');
  });
});

describe('textoResolvido', () => {
  const texto = (formula: string, ctx: ContextoFormula = contexto) => {
    const r = textoResolvido(ler(formula), ctx);
    return r.ok ? r.texto : `ERRO: ${r.erro}`;
  };

  it('troca os nomes por números e mantém os dados', () => {
    expect(texto('1d8 + mod(FOR)')).toBe('1d8 + 3');
    expect(texto('(prof)d6 + 1')).toBe('3d6 + 1');
    expect(texto('2d20kh1 + prof')).toBe('2d20kh1 + 3');
  });

  it('escreve somas negativas como subtração', () => {
    expect(texto('1d4 + mod(8)')).toBe('1d4 - 1');
    expect(texto('1d4 - mod(8)')).toBe('1d4 + 1');
  });

  it('mantém só os parênteses necessários', () => {
    expect(texto('(1d6 + 2) * 2')).toBe('(1d6 + 2) * 2');
    expect(texto('1d6 - (1d4 + 1)')).toBe('1d6 - (1d4 + 1)');
    expect(texto('1d6 + (1d4 + 1)')).toBe('1d6 + 1d4 + 1');
    expect(texto('-(1d4 + 1)')).toBe('-(1d4 + 1)');
  });

  it('sem dados, vira o número', () => {
    expect(texto('10 + mod(DES)')).toBe('12');
    expect(texto('7 / 3')).toBe('2.33');
  });

  it('abre colunas da tabela que têm dados', () => {
    const comTabela: ContextoFormula = {
      ...contexto,
      tabela: (coluna) => (coluna === 'furtivo' ? ler('(piso((nivel + 1) / 2))d6') : undefined),
    };
    expect(texto('tabela(furtivo) + mod(DES)', comTabela)).toBe('3d6 + 2');
  });
});

describe('usoDaFormula', () => {
  it('lista nomes, funções, colunas e dados', () => {
    const uso = usoDaFormula(ler('mod(DES) + Nível + tabela(Fúrias) + max(prof, 1) + 1d4 + ilimitado'));
    expect([...uso.nomes].sort()).toEqual(['des', 'nivel', 'prof']);
    expect([...uso.funcoes]).toEqual(['mod']);
    expect([...uso.colunas]).toEqual(['furias']);
    expect(uso.temDados).toBe(true);
  });
});
