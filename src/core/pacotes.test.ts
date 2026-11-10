import { describe, expect, it } from 'vitest';
import { aplicarAcaoCompendio, criarCompendioVazio } from './compendio';
import { criarEntrada, type Entrada, type TipoEntrada } from './entradas';
import {
  contarImportacao,
  entradasParaImportar,
  lerIndicePacotes,
  lerPacote,
  pacoteParaObjeto,
  VERSAO_PACOTE,
  type Pacote,
} from './pacotes';
import { VISIVEL_A_TODOS } from './visibilidade';

function doPacote(entrada: Entrada, nome: string): Entrada {
  return { ...entrada, nome, origem: { tipo: 'pacote', pacote: 'teste' }, visibilidade: VISIVEL_A_TODOS };
}

const adaga = doPacote(criarEntrada('item', 'teste/adaga'), 'Dagger');
const escudo = doPacote(criarEntrada('item', 'teste/escudo'), 'Shield');
const goblin = doPacote(criarEntrada('monstro', 'teste/goblin'), 'Goblin');

const pacote: Pacote = {
  id: 'teste',
  nome: 'Pacote de teste',
  descricao: 'Só para os testes.',
  creditos: [{ titulo: 'Licença', texto: 'Texto da licença.' }],
  entradas: [adaga, escudo, goblin],
};

const texto = (valor: unknown) => JSON.stringify(valor);

describe('lerPacote', () => {
  it('lê de volta o que foi gravado', () => {
    expect(lerPacote(texto(pacoteParaObjeto(pacote)))).toEqual({ ok: true, pacote });
  });

  it('recusa formato ou versão desconhecidos', () => {
    expect(lerPacote(texto({ ...pacoteParaObjeto(pacote), versao: 99 }))).toMatchObject({ ok: false });
    expect(lerPacote(texto({ ...pacoteParaObjeto(pacote), formato: 'outro' }))).toMatchObject({ ok: false });
    expect(lerPacote('não é json')).toMatchObject({ ok: false });
  });

  it('exige créditos', () => {
    expect(lerPacote(texto({ ...pacoteParaObjeto(pacote), creditos: [] }))).toMatchObject({
      ok: false,
      erro: expect.stringContaining('créditos'),
    });
  });

  it('recusa entradas que dizem vir de outro lugar', () => {
    const daCampanha = { ...adaga, origem: { tipo: 'campanha' } };
    const deOutro = { ...adaga, origem: { tipo: 'pacote', pacote: 'outro' } };
    for (const intrusa of [daCampanha, deOutro]) {
      expect(lerPacote(texto({ ...pacoteParaObjeto(pacote), entradas: [intrusa] }))).toMatchObject({
        ok: false,
        erro: expect.stringContaining('não diz que veio deste pacote'),
      });
    }
  });

  it('confere cada entrada com as mesmas regras do compêndio', () => {
    const quebrada = { ...adaga, dados: { ...adaga.dados, peso: -1 } };
    expect(lerPacote(texto({ ...pacoteParaObjeto(pacote), entradas: [quebrada] }))).toMatchObject({ ok: false });
  });
});

describe('lerIndicePacotes', () => {
  const resumo = { id: 'teste', nome: 'Teste', descricao: '', arquivo: 'teste.json', creditos: pacote.creditos };

  it('lê a lista de pacotes', () => {
    expect(lerIndicePacotes(texto({ versao: VERSAO_PACOTE, pacotes: [resumo] }))).toEqual({ ok: true, pacotes: [resumo] });
  });

  it('recusa arquivos fora da pasta dos pacotes', () => {
    for (const arquivo of ['../segredo.json', 'sub/pasta.json', 'https://exemplo.com/x.json', 'x.js']) {
      expect(lerIndicePacotes(texto({ versao: VERSAO_PACOTE, pacotes: [{ ...resumo, arquivo }] }))).toMatchObject({ ok: false });
    }
  });
});

describe('importação de um pacote', () => {
  const editado = { ...adaga, nome: 'Adaga do mestre' };
  const estado = aplicarAcaoCompendio(criarCompendioVazio(), { tipo: 'AdicionarEntrada', entrada: editado });

  it('conta novas e existentes por tipo', () => {
    const contagem = contarImportacao(estado, pacote);
    expect(contagem.item).toEqual({ novas: 1, existentes: 1 });
    expect(contagem.monstro).toEqual({ novas: 1, existentes: 0 });
    expect(contagem.magia).toEqual({ novas: 0, existentes: 0 });
  });

  it('traz só os tipos escolhidos e nunca substitui o que já existe', () => {
    const tipos = new Set<TipoEntrada>(['item']);
    expect(entradasParaImportar(estado, pacote, tipos)).toEqual([escudo]);
    const depois = aplicarAcaoCompendio(estado, {
      tipo: 'ImportarEntradas',
      entradas: entradasParaImportar(estado, pacote, new Set<TipoEntrada>(['item', 'monstro'])),
    });
    expect(depois.entradas['teste/adaga']).toBe(editado);
    expect(Object.keys(depois.entradas).sort()).toEqual(['teste/adaga', 'teste/escudo', 'teste/goblin']);
  });
});
