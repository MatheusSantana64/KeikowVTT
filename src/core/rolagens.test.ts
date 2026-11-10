import { describe, expect, it } from 'vitest';
import {
  criarLojaRolagens,
  desserializarRolagens,
  LIMITE_ROLAGENS,
  naturalDaRolagem,
  serializarRolagens,
  visibilidadeDaRolagem,
  type NovaRolagem,
} from './rolagens';

const nova = (total: number, valores = [total]): NovaRolagem => ({
  autorId: 'mestre',
  fichaId: 'f1',
  quem: 'Ana',
  rotulo: 'Atletismo',
  formula: '1d20 + 3',
  dados: [{ texto: '1d20', faces: 20, valores, mantidos: valores.map(() => true) }],
  total,
  visibilidade: visibilidadeDaRolagem(false),
});

describe('registro de rolagens', () => {
  it('guarda da mais nova para a mais antiga, com o 20 e o 1 natural', () => {
    let n = 0;
    const loja = criarLojaRolagens([], () => 1000 + n, () => `r${++n}`);
    loja.registrar(nova(20));
    loja.registrar(nova(1));
    loja.registrar(nova(12));
    expect(loja.obterRolagens().map((r) => [r.id, r.natural])).toEqual([
      ['r3', null],
      ['r2', 1],
      ['r1', 20],
    ]);
  });

  it('na vantagem, vale o d20 que ficou', () => {
    expect(naturalDaRolagem([{ texto: '2d20kh1', faces: 20, valores: [1, 20], mantidos: [false, true] }])).toBe(20);
    expect(naturalDaRolagem([{ texto: '2d20kl1', faces: 20, valores: [1, 20], mantidos: [true, false] }])).toBe(1);
    expect(naturalDaRolagem([{ texto: '1d6', faces: 6, valores: [6], mantidos: [true] }])).toBeNull();
  });

  it(`guarda só as últimas ${LIMITE_ROLAGENS}`, () => {
    const loja = criarLojaRolagens();
    for (let i = 0; i < LIMITE_ROLAGENS + 5; i++) {
      loja.registrar(nova(i % 19 + 2));
    }
    expect(loja.obterRolagens()).toHaveLength(LIMITE_ROLAGENS);
  });

  it('rolagens secretas são só do mestre', () => {
    expect(visibilidadeDaRolagem(true)).toEqual({ tipo: 'mestre' });
    expect(visibilidadeDaRolagem(false)).toEqual({ tipo: 'todos' });
  });

  it('salva e lê de volta; recusa formato desconhecido', () => {
    const loja = criarLojaRolagens();
    loja.registrar(nova(20));
    loja.registrar({ ...nova(7), visibilidade: visibilidadeDaRolagem(true) });
    const lido = desserializarRolagens(serializarRolagens(loja.obterRolagens()));
    expect(lido).toEqual({ ok: true, rolagens: loja.obterRolagens() });
    expect(desserializarRolagens('{"versao":9,"rolagens":[]}').ok).toBe(false);
  });
});
