import { describe, expect, it } from 'vitest';
import { aplicarAcao, criarMapaVazio, hexEm, type AcaoMapa, type EstadoMapa, type Nota } from './mapa';
import { SO_MESTRE, VISIVEL_A_TODOS, visaoDoJogador } from './visibilidade';

const A = { q: 0, r: 0 };
const B = { q: 1, r: 0 };
const VAZIO = { q: 9, r: 9 };

const publica: Nota = { id: 'n1', texto: 'Uma ponte antiga', visibilidade: VISIVEL_A_TODOS };
const secreta: Nota = { id: 'n2', texto: 'Há um dragão sob a ponte', visibilidade: SO_MESTRE };

function aplicarTodas(acoes: AcaoMapa[], inicial: EstadoMapa = criarMapaVazio()): EstadoMapa {
  return acoes.reduce(aplicarAcao, inicial);
}

const mapaComNotas = () =>
  aplicarTodas([
    { tipo: 'ColocarTile', coord: A, terreno: 'hexPlains00' },
    { tipo: 'ColocarTile', coord: B, terreno: 'hexHills00' },
    { tipo: 'EditarInformacaoHex', coord: A, campos: { nome: 'Vau', descricao: 'Um rio raso' } },
    { tipo: 'AdicionarNota', coord: A, nota: publica },
    { tipo: 'AdicionarNota', coord: A, nota: secreta },
  ]);

describe('EditarInformacaoHex', () => {
  it('define nome e descrição', () => {
    const hex = hexEm(mapaComNotas(), A);
    expect(hex?.nome).toBe('Vau');
    expect(hex?.descricao).toBe('Um rio raso');
  });

  it('altera só o campo informado', () => {
    const mapa = aplicarAcao(mapaComNotas(), {
      tipo: 'EditarInformacaoHex',
      coord: A,
      campos: { nome: 'Ponte Velha' },
    });
    expect(hexEm(mapa, A)?.nome).toBe('Ponte Velha');
    expect(hexEm(mapa, A)?.descricao).toBe('Um rio raso');
  });

  it('permite apagar um campo com texto vazio', () => {
    const mapa = aplicarAcao(mapaComNotas(), {
      tipo: 'EditarInformacaoHex',
      coord: A,
      campos: { nome: '' },
    });
    expect(hexEm(mapa, A)?.nome).toBe('');
  });

  it('o mesmo valor não muda nada', () => {
    const mapa = mapaComNotas();
    const acao: AcaoMapa = { tipo: 'EditarInformacaoHex', coord: A, campos: { nome: 'Vau' } };
    expect(aplicarAcao(mapa, acao)).toBe(mapa);
  });

  it('um hex vazio não guarda informação', () => {
    const mapa = mapaComNotas();
    const acao: AcaoMapa = { tipo: 'EditarInformacaoHex', coord: VAZIO, campos: { nome: 'X' } };
    expect(aplicarAcao(mapa, acao)).toBe(mapa);
  });

  it('não altera o estado anterior', () => {
    const mapa = mapaComNotas();
    aplicarAcao(mapa, { tipo: 'EditarInformacaoHex', coord: A, campos: { nome: 'Outro' } });
    expect(hexEm(mapa, A)?.nome).toBe('Vau');
  });
});

describe('AdicionarNota', () => {
  it('mantém a ordem em que as notas foram criadas', () => {
    expect(hexEm(mapaComNotas(), A)?.notas).toEqual([publica, secreta]);
  });

  it('não duplica o mesmo id', () => {
    const mapa = mapaComNotas();
    expect(aplicarAcao(mapa, { tipo: 'AdicionarNota', coord: A, nota: publica })).toBe(mapa);
  });

  it('um hex vazio não recebe notas', () => {
    const mapa = mapaComNotas();
    expect(aplicarAcao(mapa, { tipo: 'AdicionarNota', coord: VAZIO, nota: publica })).toBe(mapa);
  });
});

describe('EditarNota', () => {
  it('muda só o texto da nota pedida', () => {
    const mapa = aplicarAcao(mapaComNotas(), {
      tipo: 'EditarNota',
      coord: A,
      notaId: 'n2',
      texto: 'Dois dragões',
    });
    expect(hexEm(mapa, A)?.notas).toEqual([publica, { ...secreta, texto: 'Dois dragões' }]);
  });

  it('o mesmo texto não muda nada', () => {
    const mapa = mapaComNotas();
    const acao: AcaoMapa = { tipo: 'EditarNota', coord: A, notaId: 'n1', texto: publica.texto };
    expect(aplicarAcao(mapa, acao)).toBe(mapa);
  });

  it('uma nota inexistente não muda nada', () => {
    const mapa = mapaComNotas();
    const acao: AcaoMapa = { tipo: 'EditarNota', coord: A, notaId: 'nao-existe', texto: 'x' };
    expect(aplicarAcao(mapa, acao)).toBe(mapa);
  });
});

describe('DefinirVisibilidadeNota', () => {
  it('torna uma nota secreta em pública, mantendo o texto', () => {
    const mapa = aplicarAcao(mapaComNotas(), {
      tipo: 'DefinirVisibilidadeNota',
      coord: A,
      notaId: 'n2',
      visibilidade: VISIVEL_A_TODOS,
    });
    expect(hexEm(mapa, A)?.notas[1]).toEqual({ ...secreta, visibilidade: VISIVEL_A_TODOS });
  });

  it('a mesma visibilidade não muda nada', () => {
    const mapa = mapaComNotas();
    const acao: AcaoMapa = {
      tipo: 'DefinirVisibilidadeNota',
      coord: A,
      notaId: 'n2',
      visibilidade: SO_MESTRE,
    };
    expect(aplicarAcao(mapa, acao)).toBe(mapa);
  });
});

describe('RemoverNota', () => {
  it('remove só a nota pedida', () => {
    const mapa = aplicarAcao(mapaComNotas(), { tipo: 'RemoverNota', coord: A, notaId: 'n1' });
    expect(hexEm(mapa, A)?.notas).toEqual([secreta]);
  });

  it('uma nota inexistente não muda nada', () => {
    const mapa = mapaComNotas();
    expect(aplicarAcao(mapa, { tipo: 'RemoverNota', coord: A, notaId: 'x' })).toBe(mapa);
  });
});

describe('relação com o terreno', () => {
  it('trocar o terreno mantém as anotações', () => {
    const mapa = aplicarAcao(mapaComNotas(), {
      tipo: 'ColocarTile',
      coord: A,
      terreno: 'hexDirt00',
    });
    expect(hexEm(mapa, A)?.nome).toBe('Vau');
    expect(hexEm(mapa, A)?.notas).toEqual([publica, secreta]);
  });

  it('apagar o hex apaga as anotações, mesmo se o terreno voltar', () => {
    const mapa = aplicarTodas(
      [
        { tipo: 'RemoverTile', coord: A },
        { tipo: 'ColocarTile', coord: A, terreno: 'hexPlains00' },
      ],
      mapaComNotas(),
    );
    expect(hexEm(mapa, A)).toMatchObject({ nome: '', descricao: '', notas: [] });
  });
});

describe('visaoDoJogador', () => {
  it('remove as notas secretas', () => {
    const visao = visaoDoJogador(mapaComNotas());
    expect(hexEm(visao, A)?.notas).toEqual([publica]);
  });

  it('nenhum texto secreto sobra em lugar nenhum da visão', () => {
    expect(JSON.stringify(visaoDoJogador(mapaComNotas()))).not.toContain(secreta.texto);
  });

  it('mantém nome, descrição e terreno', () => {
    expect(hexEm(visaoDoJogador(mapaComNotas()), A)).toMatchObject({
      nome: 'Vau',
      descricao: 'Um rio raso',
      terreno: 'hexPlains00',
    });
  });

  it('uma nota tornada pública passa a aparecer', () => {
    const mapa = aplicarAcao(mapaComNotas(), {
      tipo: 'DefinirVisibilidadeNota',
      coord: A,
      notaId: 'n2',
      visibilidade: VISIVEL_A_TODOS,
    });
    expect(hexEm(visaoDoJogador(mapa), A)?.notas).toHaveLength(2);
  });

  it('não altera o mapa do mestre', () => {
    const mapa = mapaComNotas();
    visaoDoJogador(mapa);
    expect(hexEm(mapa, A)?.notas).toHaveLength(2);
  });
});
