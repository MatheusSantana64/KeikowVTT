import { describe, expect, it, vi } from 'vitest';
import { aplicarAcaoGrupo, criarLojaGrupo, GRUPO_SEM_POSICAO } from './grupo';

const A = { q: 2, r: -1 };
const B = { q: 3, r: -1 };

describe('aplicarAcaoGrupo', () => {
  it('posiciona o grupo', () => {
    expect(aplicarAcaoGrupo(GRUPO_SEM_POSICAO, { tipo: 'PosicionarGrupo', coord: A })).toEqual({
      posicao: A,
    });
  });

  it('a mesma posição não muda nada', () => {
    const estado = { posicao: A };
    expect(aplicarAcaoGrupo(estado, { tipo: 'PosicionarGrupo', coord: { ...A } })).toBe(estado);
  });

  it('sem posição continua sem posição', () => {
    expect(aplicarAcaoGrupo(GRUPO_SEM_POSICAO, { tipo: 'PosicionarGrupo', coord: null })).toBe(
      GRUPO_SEM_POSICAO,
    );
  });

  it('pode tirar o grupo do mapa', () => {
    expect(aplicarAcaoGrupo({ posicao: A }, { tipo: 'PosicionarGrupo', coord: null })).toEqual({
      posicao: null,
    });
  });
});

describe('criarLojaGrupo', () => {
  it('avisa quem assinou quando o grupo se move', () => {
    const loja = criarLojaGrupo();
    const ouvinte = vi.fn();
    loja.assinar(ouvinte);
    loja.despachar({ tipo: 'PosicionarGrupo', coord: B });
    expect(ouvinte).toHaveBeenCalledExactlyOnceWith({ posicao: B });
  });

  it('não avisa quando nada muda', () => {
    const loja = criarLojaGrupo({ posicao: A });
    const ouvinte = vi.fn();
    loja.assinar(ouvinte);
    loja.despachar({ tipo: 'PosicionarGrupo', coord: A });
    expect(ouvinte).not.toHaveBeenCalled();
  });

  it('para de avisar depois de cancelar', () => {
    const loja = criarLojaGrupo();
    const ouvinte = vi.fn();
    loja.assinar(ouvinte)();
    loja.despachar({ tipo: 'PosicionarGrupo', coord: A });
    expect(ouvinte).not.toHaveBeenCalled();
  });
});
