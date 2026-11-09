import { describe, expect, it } from 'vitest';
import { aplicarAcao, criarMapaVazio, type EstadoMapa } from './mapa';
import type { Manifesto } from './manifesto';
import { assetsDesconhecidos, desserializarMapa, serializarMapa } from './persistencia';

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
  ].reduce(aplicarAcao as never, criarMapaVazio()) as EstadoMapa;
}

const hexValido = { q: 0, r: 0, terreno: 't', decoracoes: [] };
const arquivo = (conteudo: unknown) => JSON.stringify(conteudo);
const comHexes = (...hexes: unknown[]) => arquivo({ versao: 1, hexes });
const decoracao = (id: string) => ({ id, assetId: 'a', deslocamento: { x: 0, y: 0 } });

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
