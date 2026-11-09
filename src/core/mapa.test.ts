import { describe, expect, it } from 'vitest';
import { aplicarAcao, criarMapaVazio, hexEm, type AcaoMapa, type Decoracao, type EstadoMapa } from './mapa';

const A = { q: 0, r: 0 };
const B = { q: 1, r: 0 };
const casa: Decoracao = { id: 'd1', assetId: 'house00', deslocamento: { x: 10, y: -20 } };

function aplicarTodas(acoes: AcaoMapa[], inicial: EstadoMapa = criarMapaVazio()): EstadoMapa {
  return acoes.reduce(aplicarAcao, inicial);
}

const mapaComCasa = () =>
  aplicarTodas([
    { tipo: 'ColocarTile', coord: A, terreno: 'hexPlains00' },
    { tipo: 'ColocarTile', coord: B, terreno: 'hexHills00' },
    { tipo: 'ColocarDecoracao', coord: A, decoracao: casa },
  ]);

describe('ColocarTile', () => {
  it('cria o hex sem decorações', () => {
    const mapa = aplicarAcao(criarMapaVazio(), { tipo: 'ColocarTile', coord: A, terreno: 'hexPlains00' });
    expect(hexEm(mapa, A)).toEqual({ coord: A, terreno: 'hexPlains00', decoracoes: [] });
  });

  it('não altera o estado anterior', () => {
    const antes = criarMapaVazio();
    aplicarAcao(antes, { tipo: 'ColocarTile', coord: A, terreno: 'hexPlains00' });
    expect(antes).toEqual(criarMapaVazio());
  });

  it('trocar o terreno mantém as decorações', () => {
    const mapa = aplicarAcao(mapaComCasa(), { tipo: 'ColocarTile', coord: A, terreno: 'hexDirt00' });
    expect(hexEm(mapa, A)?.terreno).toBe('hexDirt00');
    expect(hexEm(mapa, A)?.decoracoes).toEqual([casa]);
  });

  it('colocar o mesmo terreno não muda nada', () => {
    const mapa = mapaComCasa();
    expect(aplicarAcao(mapa, { tipo: 'ColocarTile', coord: A, terreno: 'hexPlains00' })).toBe(mapa);
  });
});

describe('RemoverTile', () => {
  it('apaga o hex junto com as decorações', () => {
    const mapa = aplicarAcao(mapaComCasa(), { tipo: 'RemoverTile', coord: A });
    expect(hexEm(mapa, A)).toBeUndefined();
    expect(hexEm(mapa, B)).toBeDefined();
  });

  it('remover um hex vazio não muda nada', () => {
    const mapa = mapaComCasa();
    expect(aplicarAcao(mapa, { tipo: 'RemoverTile', coord: { q: 9, r: 9 } })).toBe(mapa);
  });
});

describe('ColocarDecoracao', () => {
  it('não coloca em hex vazio', () => {
    const mapa = criarMapaVazio();
    expect(aplicarAcao(mapa, { tipo: 'ColocarDecoracao', coord: A, decoracao: casa })).toBe(mapa);
  });

  it('não duplica o mesmo id', () => {
    const mapa = mapaComCasa();
    expect(aplicarAcao(mapa, { tipo: 'ColocarDecoracao', coord: A, decoracao: casa })).toBe(mapa);
  });
});

describe('MoverDecoracao', () => {
  const novaPosicao = { x: 1, y: 2 };

  it('move dentro do mesmo hex', () => {
    const mapa = aplicarAcao(mapaComCasa(), {
      tipo: 'MoverDecoracao',
      origem: A,
      decoracaoId: 'd1',
      destino: A,
      deslocamento: novaPosicao,
    });
    expect(hexEm(mapa, A)?.decoracoes).toEqual([{ ...casa, deslocamento: novaPosicao }]);
  });

  it('move para outro hex', () => {
    const mapa = aplicarAcao(mapaComCasa(), {
      tipo: 'MoverDecoracao',
      origem: A,
      decoracaoId: 'd1',
      destino: B,
      deslocamento: novaPosicao,
    });
    expect(hexEm(mapa, A)?.decoracoes).toEqual([]);
    expect(hexEm(mapa, B)?.decoracoes).toEqual([{ ...casa, deslocamento: novaPosicao }]);
  });

  it('não move para hex vazio nem perde a decoração', () => {
    const mapa = mapaComCasa();
    const resultado = aplicarAcao(mapa, {
      tipo: 'MoverDecoracao',
      origem: A,
      decoracaoId: 'd1',
      destino: { q: 9, r: 9 },
      deslocamento: novaPosicao,
    });
    expect(resultado).toBe(mapa);
  });
});

describe('RemoverDecoracao', () => {
  it('remove só a decoração pedida', () => {
    const outra: Decoracao = { ...casa, id: 'd2' };
    const mapa = aplicarTodas(
      [
        { tipo: 'ColocarDecoracao', coord: A, decoracao: outra },
        { tipo: 'RemoverDecoracao', coord: A, decoracaoId: 'd1' },
      ],
      mapaComCasa(),
    );
    expect(hexEm(mapa, A)?.decoracoes).toEqual([outra]);
  });

  it('id inexistente não muda nada', () => {
    const mapa = mapaComCasa();
    expect(aplicarAcao(mapa, { tipo: 'RemoverDecoracao', coord: A, decoracaoId: 'nao-existe' })).toBe(mapa);
  });
});

describe('repetição de ações', () => {
  it('a mesma lista de ações sempre produz o mesmo mapa', () => {
    expect(mapaComCasa()).toEqual(mapaComCasa());
  });
});
