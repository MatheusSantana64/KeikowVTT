import { describe, expect, it, vi } from 'vitest';
import { criarCampanhaInicial } from './campanha';
import { aplicarAcaoCompendio, criarCompendioVazio } from './compendio';
import { criarEntrada } from './entradas';
import { criarFicha } from './fichas';
import { desserializarCampanha, serializarCampanha } from './persistenciaCampanha';
import { criarLojaRegras, novoIdDeRegra, usosDoNome } from './regrasDaCampanha';
import type { Regras } from './regras';
import { REGRAS_PADRAO } from './regrasPadrao';

const comValor = (regras: Regras, id: string, formula: string): Regras => ({
  ...regras,
  valores: [...regras.valores, { id, nome: id, formula, descricao: '' }],
});

describe('loja das regras', () => {
  it('começa com as regras padrão e aceita mudanças sem problemas, com desfazer', () => {
    const loja = criarLojaRegras();
    expect(loja.obterEstado()).toBe(REGRAS_PADRAO);
    loja.despachar({ tipo: 'EditarRegras', regras: { ...REGRAS_PADRAO, pesoPorMoeda: 0 } });
    expect(loja.obterEstado().pesoPorMoeda).toBe(0);
    loja.desfazer();
    expect(loja.obterEstado().pesoPorMoeda).toBe(0.01);
  });

  it('recusa regras com problema: nada muda e as fichas seguem com a última versão boa', () => {
    const loja = criarLojaRegras();
    loja.despachar({ tipo: 'EditarRegras', regras: comValor(REGRAS_PADRAO, 'sanidade', 'sanidade + 1') });
    loja.despachar({ tipo: 'EditarRegras', regras: comValor(REGRAS_PADRAO, 'sanidade', 'nada_disso') });
    loja.despachar({ tipo: 'EditarRegras', regras: comValor(REGRAS_PADRAO, 'sanidade', '1d6') });
    expect(loja.obterEstado()).toBe(REGRAS_PADRAO);
    expect(loja.podeDesfazer()).toBe(false);
  });

  it('só o mestre muda as regras', () => {
    const aoRecusar = vi.fn();
    const loja = criarLojaRegras(undefined, { obterAutorId: () => 'ana', aoRecusar });
    loja.despachar({ tipo: 'EditarRegras', regras: { ...REGRAS_PADRAO, pesoPorMoeda: 0 } });
    expect(loja.obterEstado()).toBe(REGRAS_PADRAO);
    expect(aoRecusar).toHaveBeenCalledWith('Só o mestre muda as regras.');
  });
});

describe('nomes internos novos', () => {
  it('saem do nome, sem acento nem espaço, e nunca repetem', () => {
    expect(novoIdDeRegra(REGRAS_PADRAO, 'Sanidade')).toBe('sanidade');
    expect(novoIdDeRegra(REGRAS_PADRAO, 'Carga Máxima!')).toBe('carga_maxima');
    expect(novoIdDeRegra(REGRAS_PADRAO, 'Atletismo')).toBe('atletismo_2');
    expect(novoIdDeRegra(REGRAS_PADRAO, 'CA')).toBe('ca_2');
    expect(novoIdDeRegra(REGRAS_PADRAO, '2ª vida')).toBe('n_2_vida');
    expect(novoIdDeRegra(REGRAS_PADRAO, '???')).toBe('novo');
  });
});

describe('quem usa um nome', () => {
  it('conta entradas com fórmulas que o citam e fichas com proficiência marcada ou cópias que o citam', () => {
    const anel = { ...criarEntrada('item', 'anel'), efeitos: [{ alvo: 'ca', tipo: 'somar', valor: '1', quando: 'equipado' }] } as never;
    const livro = { ...criarEntrada('item', 'livro'), descricao: 'Fala de ca e de atletismo.' };
    const compendio = [anel, livro].reduce((c, entrada) => aplicarAcaoCompendio(c, { tipo: 'AdicionarEntrada', entrada }), criarCompendioVazio());
    const marcada = { ...criarFicha('personagem', 'f1'), proficiencias: { atletismo: 1 } };
    const fichas = { fichas: { f1: marcada, f2: criarFicha('npc', 'f2') } };
    expect(usosDoNome('atletismo', compendio, fichas)).toEqual({ entradas: 0, fichas: 1 });
    expect(usosDoNome('ca', compendio, fichas)).toEqual({ entradas: 1, fichas: 0 });
  });
});

describe('regras guardadas com a campanha', () => {
  it('voltam iguais; campanhas da versão 1 ganham as regras padrão', () => {
    const regras = { ...comValor(REGRAS_PADRAO, 'sanidade', 'SAB * 5'), pesoPorMoeda: 0 };
    const texto = serializarCampanha({ campanha: criarCampanhaInicial(), registro: [], regras });
    expect(desserializarCampanha(texto)).toMatchObject({ ok: true, regras });
    const antiga = JSON.stringify({ versao: 1, ...criarCampanhaInicial(), registro: [] });
    expect(desserializarCampanha(antiga)).toMatchObject({ ok: true, regras: REGRAS_PADRAO });
  });

  it('recusa regras guardadas com problema', () => {
    const quebrada = JSON.stringify({ versao: 2, ...criarCampanhaInicial(), registro: [], regras: comValor(REGRAS_PADRAO, 'x', 'x') });
    expect(desserializarCampanha(quebrada)).toMatchObject({ ok: false, erro: expect.stringContaining('Depende de si mesmo') });
  });
});
