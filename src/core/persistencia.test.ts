import { describe, expect, it } from 'vitest';
import { aplicarAcao, criarMapaVazio, type EstadoMapa } from './mapa';
import type { Manifesto } from './manifesto';
import { assetsDesconhecidos, desserializarMapa, serializarMapa } from './persistencia';
import { SO_MESTRE, VISIVEL_A_TODOS } from './visibilidade';

const A = { q: -2, r: 3 };
const B = { q: 1, r: 0 };

function mapaExemplo(): EstadoMapa {
  return [
    { tipo: 'ColocarTile', coord: A, terreno: 'hexPlains00' },
    { tipo: 'ColocarTile', coord: B, terreno: 'hexHills00' },
    {
      tipo: 'ColocarDecoracao',
      coord: A,
      decoracao: { id: 'd1', assetId: 'house00', deslocamento: { x: 10.5, y: -20 } },
    },
    { tipo: 'EditarInformacaoHex', coord: A, campos: { nome: 'Vau', descricao: 'Rio "raso"\nAo norte' } },
    { tipo: 'AdicionarNota', coord: A, nota: { id: 'n1', texto: 'Ponte', visibilidade: VISIVEL_A_TODOS } },
    { tipo: 'AdicionarNota', coord: A, nota: { id: 'n2', texto: 'Dragão', visibilidade: SO_MESTRE } },
  ].reduce(aplicarAcao as never, criarMapaVazio()) as EstadoMapa;
}

const hexValido = { q: 0, r: 0, terreno: 't', decoracoes: [], nome: '', descricao: '', notas: [] };
const arquivo = (conteudo: unknown) => JSON.stringify(conteudo);
const comHexes = (...hexes: unknown[]) => arquivo({ versao: 2, hexes });
const decoracao = (id: string) => ({ id, assetId: 'a', deslocamento: { x: 0, y: 0 } });
const nota = (id: string) => ({ id, texto: 'x', visibilidade: { tipo: 'mestre' } });

function erroDe(texto: string): string {
  const resultado = desserializarMapa(texto);
  if (resultado.ok) {
    throw new Error('Era esperado um erro de leitura.');
  }
  return resultado.erro;
}

describe('salvar e carregar', () => {
  it('um mapa salvo e carregado volta idêntico', () => {
    const mapa = mapaExemplo();
    expect(desserializarMapa(serializarMapa(mapa))).toEqual({ ok: true, estado: mapa });
  });

  it('um mapa vazio também funciona', () => {
    expect(desserializarMapa(serializarMapa(criarMapaVazio()))).toEqual({
      ok: true,
      estado: criarMapaVazio(),
    });
  });
});

describe('mapas no formato antigo (versão 1)', () => {
  const antigo = arquivo({
    versao: 1,
    hexes: [
      {
        q: 2,
        r: -1,
        terreno: 'hexPlains00',
        decoracoes: [decoracao('d1')],
      },
    ],
  });

  it('abre preservando terreno e decorações, com as informações vazias', () => {
    expect(desserializarMapa(antigo)).toEqual({
      ok: true,
      estado: {
        hexes: {
          '2,-1': {
            coord: { q: 2, r: -1 },
            terreno: 'hexPlains00',
            decoracoes: [decoracao('d1')],
            nome: '',
            descricao: '',
            notas: [],
          },
        },
      },
    });
  });

  it('continua recusando hexes inválidos', () => {
    expect(erroDe(arquivo({ versao: 1, hexes: [{ q: 'a', r: 0 }] }))).toContain('coordenadas');
    expect(erroDe(arquivo({ versao: 1, hexes: ['texto'] }))).toContain('nº 1');
  });

  it('ao salvar de novo, passa para a versão atual', () => {
    const resultado = desserializarMapa(antigo);
    if (!resultado.ok) {
      throw new Error(resultado.erro);
    }
    expect(JSON.parse(serializarMapa(resultado.estado)).versao).toBe(2);
  });
});

describe('arquivos inválidos', () => {
  it('recusa um texto que não é JSON', () => {
    expect(erroDe('isto não é json')).toContain('JSON');
  });

  it.each([['null'], ['[]'], ['123'], ['{"nome":"outro arquivo"}']])(
    'recusa um JSON que não é mapa: %s',
    (texto) => {
      expect(erroDe(texto)).toContain('não é um mapa');
    },
  );

  it('recusa uma versão desconhecida', () => {
    expect(erroDe(arquivo({ versao: 99, hexes: [] }))).toContain('99');
  });

  it('recusa um arquivo sem a lista de hexes', () => {
    expect(erroDe(arquivo({ versao: 1 }))).toContain('lista de hexes');
  });

  it.each([
    ['coordenada fracionária', { ...hexValido, q: 1.5 }],
    ['coordenada ausente', { terreno: 't', decoracoes: [] }],
    ['coordenada em texto', { ...hexValido, r: '2' }],
    ['terreno ausente', { q: 0, r: 0, decoracoes: [] }],
    ['terreno vazio', { ...hexValido, terreno: '' }],
    ['decorações ausentes', { q: 0, r: 0, terreno: 't' }],
  ])('recusa um hex com %s e diz qual é', (_, hex) => {
    expect(erroDe(comHexes(hexValido, hex))).toContain('nº 2');
  });

  it.each([
    ['sem id', { assetId: 'a', deslocamento: { x: 0, y: 0 } }],
    ['sem imagem', { id: 'd', deslocamento: { x: 0, y: 0 } }],
    ['sem posição', { id: 'd', assetId: 'a' }],
    ['com posição em texto', { id: 'd', assetId: 'a', deslocamento: { x: '1', y: 0 } }],
  ])('recusa uma decoração %s', (_, invalida) => {
    expect(erroDe(comHexes({ ...hexValido, decoracoes: [invalida] }))).toContain('decoração');
  });

  it.each([
    ['sem nome', { q: 0, r: 0, terreno: 't', decoracoes: [], descricao: '', notas: [] }],
    ['com nome que não é texto', { ...hexValido, nome: 5 }],
    ['sem descrição', { q: 0, r: 0, terreno: 't', decoracoes: [], nome: '', notas: [] }],
    ['sem lista de notas', { q: 0, r: 0, terreno: 't', decoracoes: [], nome: '', descricao: '' }],
  ])('recusa um hex %s', (_, hex) => {
    expect(erroDe(comHexes(hex))).toContain('nº 1');
  });

  it.each([
    ['sem id', { texto: 'x', visibilidade: { tipo: 'todos' } }],
    ['sem texto', { id: 'n', visibilidade: { tipo: 'todos' } }],
    ['sem visibilidade', { id: 'n', texto: 'x' }],
    ['com visibilidade em texto', { id: 'n', texto: 'x', visibilidade: 'todos' }],
    ['com visibilidade desconhecida', { id: 'n', texto: 'x', visibilidade: { tipo: 'outra' } }],
  ])('recusa uma nota %s', (_, invalida) => {
    expect(erroDe(comHexes({ ...hexValido, notas: [invalida] }))).toContain('nota nº 1');
  });

  it('aceita uma nota com texto vazio', () => {
    const vazia = { id: 'n', texto: '', visibilidade: { tipo: 'todos' } };
    expect(desserializarMapa(comHexes({ ...hexValido, notas: [vazia] })).ok).toBe(true);
  });

  it('recusa o mesmo id de nota em hexes diferentes', () => {
    const texto = comHexes(
      { ...hexValido, notas: [nota('n')] },
      { ...hexValido, q: 1, notas: [nota('n')] },
    );
    expect(erroDe(texto)).toContain('repetida');
  });

  it('recusa um hex repetido', () => {
    expect(erroDe(comHexes(hexValido, hexValido))).toContain('mais de uma vez');
  });

  it('recusa o mesmo id de decoração em hexes diferentes', () => {
    const texto = comHexes(
      { ...hexValido, decoracoes: [decoracao('d')] },
      { ...hexValido, q: 1, decoracoes: [decoracao('d')] },
    );
    expect(erroDe(texto)).toContain('repetida');
  });
});

describe('assetsDesconhecidos', () => {
  const manifesto = {
    categorias: [],
    assets: [{ id: 'hexPlains00' }, { id: 'house00' }],
  } as unknown as Manifesto;

  it('lista terrenos e decorações que não existem, sem repetir', () => {
    expect(assetsDesconhecidos(mapaExemplo(), manifesto)).toEqual(['hexHills00']);
  });

  it('devolve lista vazia quando tudo existe', () => {
    const completo = {
      ...manifesto,
      assets: [...manifesto.assets, { id: 'hexHills00' }],
    } as unknown as Manifesto;
    expect(assetsDesconhecidos(mapaExemplo(), completo)).toEqual([]);
  });
});
