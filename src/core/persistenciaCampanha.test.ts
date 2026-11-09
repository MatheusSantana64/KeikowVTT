import { describe, expect, it } from 'vitest';
import { aplicarAcaoCampanha, criarCampanhaInicial } from './campanha';
import { GRUPO_SEM_POSICAO } from './grupo';
import { aplicarAcao, criarMapaVazio } from './mapa';
import { desserializarMapa, serializarMapa } from './persistencia';
import {
  desserializarCampanha,
  lerCampanhaDoArquivo,
  serializarArquivoCompleto,
  serializarCampanha,
  type ConteudoCampanha,
} from './persistenciaCampanha';
import { criarLojaRegistro } from './registro';

function exemplo(): ConteudoCampanha {
  const registro = criarLojaRegistro([], () => 500);
  registro.registrar({ tipo: 'ColocarTile', coord: { q: 1, r: -1 }, autorId: 'mestre', agrupamento: null });
  registro.registrar({ tipo: 'CarregarMapa', coord: null, autorId: 'j1', agrupamento: null });
  const campanha = aplicarAcaoCampanha(criarCampanhaInicial(), {
    tipo: 'AdicionarParticipante',
    id: 'j1',
    nome: 'Ana',
  });
  return { campanha, registro: registro.obterEntradas() };
}

const valido = () => JSON.parse(serializarCampanha(exemplo()));

function erroDe(dados: unknown): string {
  const resultado = desserializarCampanha(JSON.stringify(dados));
  if (resultado.ok) {
    throw new Error('Era esperado um erro de leitura.');
  }
  return resultado.erro;
}

describe('salvamento da campanha', () => {
  it('volta idêntica', () => {
    expect(desserializarCampanha(serializarCampanha(exemplo()))).toEqual({ ok: true, ...exemplo() });
  });

  it('recusa texto que não é JSON', () => {
    expect(desserializarCampanha('lixo')).toMatchObject({ ok: false });
  });

  it('recusa versão desconhecida', () => {
    expect(erroDe({ ...valido(), versao: 9 })).toContain('formato desconhecido');
  });

  it.each([
    ['sem nome', { nome: undefined }, 'sem nome'],
    ['sem participantes', { participantes: undefined }, 'participantes'],
    ['sem registro', { registro: undefined }, 'registro'],
  ])('recusa campanha %s', (_, mudanca, trecho) => {
    expect(erroDe({ ...valido(), ...mudanca })).toContain(trecho);
  });

  it('recusa participantes repetidos', () => {
    const dados = valido();
    expect(erroDe({ ...dados, participantes: [...dados.participantes, dados.participantes[1]] })).toContain(
      'repetidos',
    );
  });

  it('recusa campanha sem mestre', () => {
    const dados = valido();
    expect(erroDe({ ...dados, participantes: [dados.participantes[1]] })).toContain('mestre');
  });

  it('recusa dois mestres', () => {
    const dados = valido();
    const segundo = { id: 'j2', nome: 'X', papel: 'mestre' };
    expect(erroDe({ ...dados, participantes: [...dados.participantes, segundo] })).toContain('mestre');
  });

  it('recusa papel desconhecido', () => {
    const dados = valido();
    const estranho = { ...dados.participantes[1], papel: 'rei' };
    expect(erroDe({ ...dados, participantes: [dados.participantes[0], estranho] })).toContain('papel');
  });

  it.each([
    ['sem autor', { autorId: '' }, 'autor'],
    ['sem horário', { momento: 'ontem' }, 'horário'],
    ['com quantidade zero', { quantidade: 0 }, 'quantidade'],
    ['com coordenada ruim', { coord: { q: 1.5, r: 0 } }, 'coordenadas'],
    ['com visibilidade desconhecida', { visibilidade: { tipo: 'x' } }, 'visibilidade'],
  ])('recusa uma linha de registro %s', (_, mudanca, trecho) => {
    const dados = valido();
    expect(erroDe({ ...dados, registro: [{ ...dados.registro[0], ...mudanca }] })).toContain(trecho);
  });
});

describe('arquivo completo', () => {
  const mapa = () =>
    aplicarAcao(criarMapaVazio(), { tipo: 'ColocarTile', coord: { q: 0, r: 0 }, terreno: 't' });

  it('o mapa continua legível dentro do arquivo', () => {
    const texto = serializarArquivoCompleto(mapa(), GRUPO_SEM_POSICAO, exemplo());
    expect(desserializarMapa(texto)).toEqual({ ok: true, estado: mapa(), grupo: GRUPO_SEM_POSICAO });
  });

  it('traz a campanha junto', () => {
    const texto = serializarArquivoCompleto(mapa(), GRUPO_SEM_POSICAO, exemplo());
    expect(lerCampanhaDoArquivo(texto)).toEqual({ ok: true, conteudo: exemplo() });
  });

  it('um arquivo antigo, só de mapa, não traz campanha', () => {
    expect(lerCampanhaDoArquivo(serializarMapa(mapa(), GRUPO_SEM_POSICAO))).toEqual({
      ok: true,
      conteudo: null,
    });
  });

  it('uma campanha inválida no arquivo devolve o motivo', () => {
    const dados = JSON.parse(serializarArquivoCompleto(mapa(), GRUPO_SEM_POSICAO, exemplo()));
    dados.campanha.participantes = 'ninguém';
    expect(lerCampanhaDoArquivo(JSON.stringify(dados))).toMatchObject({ ok: false });
  });
});
