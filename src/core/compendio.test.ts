import { describe, expect, it } from 'vitest';
import {
  aplicarAcaoCompendio,
  buscarEntradas,
  criarCompendioVazio,
  criarLojaCompendio,
  entradaEm,
  type AcaoCompendio,
  type EstadoCompendio,
} from './compendio';
import { criarEntrada, TIPOS_ENTRADA, type Entrada } from './entradas';
import { criarLojaRegistro } from './registro';

function comNome(entrada: Entrada, nome: string, etiquetas: string[] = []): Entrada {
  return { ...entrada, nome, etiquetas };
}

const espada = comNome(criarEntrada('item', 'espada'), 'Espada Longa', ['arma', 'Marcial']);
const escudo = comNome(criarEntrada('item', 'escudo'), 'Escudo', ['armadura']);
const bolaDeFogo = comNome(criarEntrada('magia', 'bola'), 'Bola de Fogo', ['evocação']);
const anao = comNome(criarEntrada('especie', 'anao'), 'Anão');

function aplicarTodas(acoes: AcaoCompendio[], inicial = criarCompendioVazio()): EstadoCompendio {
  return acoes.reduce(aplicarAcaoCompendio, inicial);
}

const comExemplos = () =>
  aplicarTodas([espada, escudo, bolaDeFogo, anao].map((entrada) => ({ tipo: 'AdicionarEntrada', entrada })));

describe('criarEntrada', () => {
  it.each(TIPOS_ENTRADA)('cria um(a) %s da campanha, visível só para o mestre', (tipo) => {
    const entrada = criarEntrada(tipo, 'x');
    expect(entrada).toMatchObject({
      id: 'x',
      tipo,
      nome: '',
      origem: { tipo: 'campanha' },
      visibilidade: { tipo: 'mestre' },
      efeitos: [],
      acoes: [],
    });
  });

  it('aceita um tipo escolhido na hora', () => {
    const escolhido = TIPOS_ENTRADA[Math.floor(TIPOS_ENTRADA.length / 2)];
    const entrada: Entrada = criarEntrada(escolhido, 'x');
    expect(entrada.tipo).toBe(escolhido);
  });

  it('cada entrada nova tem os próprios dados', () => {
    const a = criarEntrada('monstro', 'a');
    const b = criarEntrada('monstro', 'b');
    expect(a.dados.atributos).not.toBe(b.dados.atributos);
  });
});

describe('ações do compêndio', () => {
  it('adiciona uma entrada', () => {
    expect(entradaEm(comExemplos(), 'espada')).toEqual(espada);
  });

  it('não adiciona uma entrada com id repetido', () => {
    const estado = comExemplos();
    expect(
      aplicarAcaoCompendio(estado, { tipo: 'AdicionarEntrada', entrada: { ...espada, nome: 'Outra' } }),
    ).toBe(estado);
  });

  it('edita uma entrada inteira', () => {
    const editada = { ...espada, nome: 'Espada Bastarda' };
    const estado = aplicarAcaoCompendio(comExemplos(), { tipo: 'EditarEntrada', entrada: editada });
    expect(entradaEm(estado, 'espada')?.nome).toBe('Espada Bastarda');
  });

  it('editar não muda a origem', () => {
    const doPacote: Entrada = { ...espada, origem: { tipo: 'pacote', pacote: 'srd-5.1' } };
    const inicial = aplicarTodas([{ tipo: 'AdicionarEntrada', entrada: doPacote }]);
    const estado = aplicarAcaoCompendio(inicial, {
      tipo: 'EditarEntrada',
      entrada: { ...doPacote, nome: 'Outra', origem: { tipo: 'campanha' } },
    });
    expect(entradaEm(estado, 'espada')?.origem).toEqual({ tipo: 'pacote', pacote: 'srd-5.1' });
  });

  it('não troca o tipo de uma entrada', () => {
    const estado = comExemplos();
    const virouMagia = { ...criarEntrada('magia', 'espada'), nome: 'Espada' };
    expect(aplicarAcaoCompendio(estado, { tipo: 'EditarEntrada', entrada: virouMagia })).toBe(estado);
  });

  it('editar sem mudar nada, ou uma entrada inexistente, não muda o estado', () => {
    const estado = comExemplos();
    expect(aplicarAcaoCompendio(estado, { tipo: 'EditarEntrada', entrada: { ...espada } })).toBe(estado);
    expect(
      aplicarAcaoCompendio(estado, { tipo: 'EditarEntrada', entrada: criarEntrada('item', 'sumiu') }),
    ).toBe(estado);
  });

  it('duplica como uma entrada nova da campanha', () => {
    const doPacote: Entrada = { ...espada, origem: { tipo: 'pacote', pacote: 'srd-5.1' } };
    const estado = aplicarTodas([
      { tipo: 'AdicionarEntrada', entrada: doPacote },
      { tipo: 'DuplicarEntrada', entradaId: 'espada', novoId: 'copia' },
    ]);
    expect(entradaEm(estado, 'copia')).toEqual({
      ...doPacote,
      id: 'copia',
      nome: 'Espada Longa (cópia)',
      origem: { tipo: 'campanha' },
    });
  });

  it('não duplica para um id já usado, nem uma entrada inexistente', () => {
    const estado = comExemplos();
    expect(
      aplicarAcaoCompendio(estado, { tipo: 'DuplicarEntrada', entradaId: 'espada', novoId: 'escudo' }),
    ).toBe(estado);
    expect(
      aplicarAcaoCompendio(estado, { tipo: 'DuplicarEntrada', entradaId: 'x', novoId: 'y' }),
    ).toBe(estado);
  });

  it('remove uma entrada', () => {
    const estado = aplicarAcaoCompendio(comExemplos(), { tipo: 'RemoverEntrada', entradaId: 'escudo' });
    expect(entradaEm(estado, 'escudo')).toBeUndefined();
    expect(entradaEm(estado, 'espada')).toBeDefined();
  });

  it('importar acrescenta só o que é novo, sem sobrescrever edições', () => {
    const editada = { ...espada, nome: 'Minha Espada' };
    const estado = aplicarTodas(
      [
        { tipo: 'EditarEntrada', entrada: editada },
        {
          tipo: 'ImportarEntradas',
          entradas: [espada, comNome(criarEntrada('item', 'adaga'), 'Adaga')],
        },
      ],
      comExemplos(),
    );
    expect(entradaEm(estado, 'espada')?.nome).toBe('Minha Espada');
    expect(entradaEm(estado, 'adaga')?.nome).toBe('Adaga');
  });

  it('importar só o que já existe não muda nada', () => {
    const estado = comExemplos();
    expect(aplicarAcaoCompendio(estado, { tipo: 'ImportarEntradas', entradas: [espada] })).toBe(estado);
  });

  it('na importação, um id repetido fica com a primeira versão', () => {
    const estado = aplicarTodas([
      {
        tipo: 'ImportarEntradas',
        entradas: [comNome(criarEntrada('item', 'a'), 'Primeira'), comNome(criarEntrada('item', 'a'), 'Segunda')],
      },
    ]);
    expect(entradaEm(estado, 'a')?.nome).toBe('Primeira');
  });

  it('carregar substitui o compêndio inteiro', () => {
    const outro = aplicarTodas([{ tipo: 'AdicionarEntrada', entrada: anao }]);
    expect(aplicarAcaoCompendio(comExemplos(), { tipo: 'CarregarCompendio', estado: outro })).toBe(outro);
  });
});

describe('buscarEntradas', () => {
  const nomes = (entradas: Entrada[]) => entradas.map((e) => e.nome);

  it('sem filtro, traz tudo em ordem alfabética', () => {
    expect(nomes(buscarEntradas(comExemplos()))).toEqual(['Anão', 'Bola de Fogo', 'Escudo', 'Espada Longa']);
  });

  it('procura no nome sem diferenciar maiúsculas nem acentos', () => {
    expect(nomes(buscarEntradas(comExemplos(), { texto: 'ANAO' }))).toEqual(['Anão']);
    expect(nomes(buscarEntradas(comExemplos(), { texto: 'fogo' }))).toEqual(['Bola de Fogo']);
  });

  it('procura também nas etiquetas', () => {
    expect(nomes(buscarEntradas(comExemplos(), { texto: 'evocacao' }))).toEqual(['Bola de Fogo']);
  });

  it('filtra por tipo', () => {
    expect(nomes(buscarEntradas(comExemplos(), { tipos: ['item'] }))).toEqual(['Escudo', 'Espada Longa']);
    expect(nomes(buscarEntradas(comExemplos(), { tipos: ['magia', 'especie'] }))).toEqual([
      'Anão',
      'Bola de Fogo',
    ]);
  });

  it('filtra por etiqueta exata', () => {
    expect(nomes(buscarEntradas(comExemplos(), { etiqueta: 'marcial' }))).toEqual(['Espada Longa']);
    expect(nomes(buscarEntradas(comExemplos(), { etiqueta: 'marc' }))).toEqual([]);
  });

  it('filtra pela origem', () => {
    const doSrd: Entrada = { ...comNome(criarEntrada('item', 'srd/adaga'), 'Dagger'), origem: { tipo: 'pacote', pacote: 'srd-5.1' } };
    const estado = aplicarAcaoCompendio(comExemplos(), { tipo: 'AdicionarEntrada', entrada: doSrd });
    expect(nomes(buscarEntradas(estado, { origem: 'srd-5.1' }))).toEqual(['Dagger']);
    expect(nomes(buscarEntradas(estado, { origem: 'campanha' }))).toHaveLength(4);
    expect(nomes(buscarEntradas(estado, { origem: 'outro-pacote' }))).toEqual([]);
  });

  it('combina os filtros', () => {
    expect(nomes(buscarEntradas(comExemplos(), { texto: 'es', tipos: ['item'], etiqueta: 'arma' }))).toEqual([
      'Espada Longa',
    ]);
  });
});

describe('criarLojaCompendio', () => {
  it('desfaz e refaz, registrando no compêndio e não no mapa', () => {
    const registro = criarLojaRegistro();
    const loja = criarLojaCompendio(undefined, { aoExecutar: registro.registrar });
    loja.despachar({ tipo: 'AdicionarEntrada', entrada: espada });
    loja.desfazer();
    expect(entradaEm(loja.obterEstado(), 'espada')).toBeUndefined();
    loja.refazer();
    expect(entradaEm(loja.obterEstado(), 'espada')).toBeDefined();
    expect(registro.obterEntradas().map((e) => e.tipo)).toEqual([
      'AdicionarEntrada',
      'DesfazerCompendio',
      'RefazerCompendio',
    ]);
  });

  it('uma importação inteira é desfeita de uma vez', () => {
    const loja = criarLojaCompendio();
    loja.despachar({ tipo: 'ImportarEntradas', entradas: [espada, escudo, anao] });
    loja.desfazer();
    expect(Object.keys(loja.obterEstado().entradas)).toEqual([]);
  });

  it('digitar em um campo vira um único passo de desfazer', () => {
    const loja = criarLojaCompendio();
    loja.despachar({ tipo: 'AdicionarEntrada', entrada: espada });
    for (const nome of ['E', 'Es', 'Est']) {
      loja.despachar({ tipo: 'EditarEntrada', entrada: { ...espada, nome } }, 'g1');
    }
    loja.desfazer();
    expect(entradaEm(loja.obterEstado(), 'espada')?.nome).toBe('Espada Longa');
  });

  it('nenhum texto das entradas entra no registro', () => {
    const registro = criarLojaRegistro();
    const loja = criarLojaCompendio(undefined, { aoExecutar: registro.registrar });
    loja.despachar({ tipo: 'AdicionarEntrada', entrada: { ...espada, nome: 'SEGREDO', descricao: 'SEGREDO' } });
    expect(JSON.stringify(registro.obterEntradas())).not.toContain('SEGREDO');
  });
});
