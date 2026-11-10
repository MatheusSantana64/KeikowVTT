import { describe, expect, it, vi } from 'vitest';
import { criarFicha, criarLojaFichas } from './fichas';
import { criarLojaGrupo } from './grupo';
import { criarLojaMapa } from './loja';
import {
  criarLojaRegistro,
  LIMITE_REGISTRO,
  type EventoExecutado,
  type LojaRegistro,
} from './registro';

const A = { q: 0, r: 0 };
const B = { q: 1, r: 0 };

const evento = (extra: Partial<EventoExecutado> = {}): EventoExecutado => ({
  tipo: 'ColocarTile',
  coord: A,
  autorId: 'mestre',
  agrupamento: null,
  ...extra,
});

function mapaComRegistro(obterAutorId?: () => string) {
  const registro = criarLojaRegistro([], () => 1000);
  const loja = criarLojaMapa(undefined, { obterAutorId, aoExecutar: registro.registrar });
  return { registro, loja };
}

const tipos = (registro: LojaRegistro) => registro.obterEntradas().map((e) => e.tipo);

describe('criarLojaRegistro', () => {
  it('anota autor, horário, local e restrição ao mestre', () => {
    const registro = criarLojaRegistro([], () => 1234);
    registro.registrar(evento({ autorId: 'j1' }));
    expect(registro.obterEntradas()).toEqual([
      {
        id: 1,
        momento: 1234,
        autorId: 'j1',
        tipo: 'ColocarTile',
        coord: A,
        quantidade: 1,
        visibilidade: { tipo: 'mestre' },
      },
    ]);
  });

  it('eventos do mesmo agrupamento viram uma linha, somando a quantidade', () => {
    let relogio = 1;
    const registro = criarLojaRegistro([], () => relogio++);
    registro.registrar(evento({ agrupamento: 'g' }));
    registro.registrar(evento({ agrupamento: 'g', coord: B }));
    expect(registro.obterEntradas()).toHaveLength(1);
    expect(registro.obterEntradas()[0]).toMatchObject({ quantidade: 2, momento: 2, coord: A });
  });

  it('sem agrupamento, cada evento é uma linha', () => {
    const registro = criarLojaRegistro();
    registro.registrar(evento());
    registro.registrar(evento());
    expect(registro.obterEntradas()).toHaveLength(2);
  });

  it.each([
    ['agrupamento', { agrupamento: 'h' }],
    ['autor', { agrupamento: 'g', autorId: 'j1' }],
    ['tipo', { agrupamento: 'g', tipo: 'RemoverTile' as const }],
  ])('%s diferente abre uma linha nova', (_, extra) => {
    const registro = criarLojaRegistro();
    registro.registrar(evento({ agrupamento: 'g' }));
    registro.registrar(evento(extra));
    expect(registro.obterEntradas()).toHaveLength(2);
  });

  it('não junta com o que veio de um salvamento anterior', () => {
    const anterior = criarLojaRegistro();
    anterior.registrar(evento({ agrupamento: 'g' }));
    const registro = criarLojaRegistro(anterior.obterEntradas());
    registro.registrar(evento({ agrupamento: 'g' }));
    expect(registro.obterEntradas()).toHaveLength(2);
  });

  it('continua a numeração de um registro existente', () => {
    const anterior = criarLojaRegistro();
    anterior.registrar(evento());
    const registro = criarLojaRegistro(anterior.obterEntradas());
    registro.registrar(evento());
    expect(registro.obterEntradas()[1].id).toBe(2);
  });

  it('guarda só as linhas mais recentes', () => {
    const registro = criarLojaRegistro();
    for (let i = 0; i < LIMITE_REGISTRO + 5; i++) {
      registro.registrar(evento());
    }
    const entradas = registro.obterEntradas();
    expect(entradas).toHaveLength(LIMITE_REGISTRO);
    expect(entradas.at(-1)?.id).toBe(LIMITE_REGISTRO + 5);
  });

  it('avisa quem assinou e para de avisar ao cancelar', () => {
    const registro = criarLojaRegistro();
    const ouvinte = vi.fn();
    const cancelar = registro.assinar(ouvinte);
    registro.registrar(evento());
    cancelar();
    registro.registrar(evento());
    expect(ouvinte).toHaveBeenCalledOnce();
  });
});

describe('registro das ações do mapa', () => {
  it('registra quem está agindo no momento da ação', () => {
    let autor = 'mestre';
    const { registro, loja } = mapaComRegistro(() => autor);
    loja.despachar({ tipo: 'ColocarTile', coord: A, terreno: 't' });
    autor = 'j1';
    // Um jogador não muda o mapa: a ação é recusada e não entra no registro.
    loja.despachar({ tipo: 'ColocarTile', coord: B, terreno: 't' });
    expect(registro.obterEntradas().map((e) => e.autorId)).toEqual(['mestre']);
  });

  it('nas fichas, registra o jogador que agiu', () => {
    let autor = 'mestre';
    const registro = criarLojaRegistro();
    const fichas = criarLojaFichas(undefined, { obterAutorId: () => autor, aoExecutar: registro.registrar });
    fichas.despachar({ tipo: 'CriarFicha', ficha: criarFicha('personagem', 'f', 'j1') });
    autor = 'j1';
    fichas.despachar({ tipo: 'EditarFicha', ficha: { ...fichas.obterEstado().fichas.f, nome: 'Aria' } });
    expect(registro.obterEntradas().map((e) => e.autorId)).toEqual(['mestre', 'j1']);
  });

  it('uma pincelada vira uma linha', () => {
    const { registro, loja } = mapaComRegistro();
    loja.iniciarTraco();
    loja.despachar({ tipo: 'ColocarTile', coord: A, terreno: 't' });
    loja.despachar({ tipo: 'ColocarTile', coord: B, terreno: 't' });
    loja.terminarTraco();
    expect(registro.obterEntradas()).toHaveLength(1);
    expect(registro.obterEntradas()[0].quantidade).toBe(2);
  });

  it('duas pinceladas viram duas linhas', () => {
    const { registro, loja } = mapaComRegistro();
    for (const coord of [A, B]) {
      loja.iniciarTraco();
      loja.despachar({ tipo: 'ColocarTile', coord, terreno: 't' });
      loja.terminarTraco();
    }
    expect(registro.obterEntradas()).toHaveLength(2);
  });

  it('digitar em um campo vira uma linha', () => {
    const { registro, loja } = mapaComRegistro();
    loja.despachar({ tipo: 'ColocarTile', coord: A, terreno: 't' });
    for (const nome of ['V', 'Va', 'Vau']) {
      loja.despachar({ tipo: 'EditarInformacaoHex', coord: A, campos: { nome } }, 'g1');
    }
    expect(tipos(registro)).toEqual(['ColocarTile', 'EditarInformacaoHex']);
  });

  it('uma ação sem efeito não é registrada', () => {
    const { registro, loja } = mapaComRegistro();
    loja.despachar({ tipo: 'RemoverTile', coord: A });
    expect(registro.obterEntradas()).toEqual([]);
  });

  it('desfazer e refazer são registrados, só quando acontecem', () => {
    const { registro, loja } = mapaComRegistro();
    loja.desfazer();
    expect(registro.obterEntradas()).toEqual([]);
    loja.despachar({ tipo: 'ColocarTile', coord: A, terreno: 't' });
    loja.desfazer();
    loja.refazer();
    expect(tipos(registro)).toEqual(['ColocarTile', 'Desfazer', 'Refazer']);
  });

  it('registra o destino ao mover uma decoração', () => {
    const { registro, loja } = mapaComRegistro();
    loja.despachar({ tipo: 'ColocarTile', coord: A, terreno: 't' });
    loja.despachar({ tipo: 'ColocarTile', coord: B, terreno: 't' });
    loja.despachar({
      tipo: 'ColocarDecoracao',
      coord: A,
      decoracao: { id: 'd', assetId: 'a', deslocamento: { x: 0, y: 0 } },
    });
    loja.despachar({
      tipo: 'MoverDecoracao',
      origem: A,
      decoracaoId: 'd',
      destino: B,
      deslocamento: { x: 0, y: 0 },
    });
    expect(registro.obterEntradas().at(-1)).toMatchObject({ tipo: 'MoverDecoracao', coord: B });
  });

  it('nenhum texto escrito entra no registro', () => {
    const { registro, loja } = mapaComRegistro();
    loja.despachar({ tipo: 'ColocarTile', coord: A, terreno: 't' });
    loja.despachar({
      tipo: 'AdicionarNota',
      coord: A,
      nota: { id: 'n', texto: 'SEGREDO', visibilidade: { tipo: 'mestre' } },
    });
    loja.despachar({ tipo: 'EditarInformacaoHex', coord: A, campos: { nome: 'SEGREDO' } });
    expect(JSON.stringify(registro.obterEntradas())).not.toContain('SEGREDO');
  });

  it('abrir um mapa inteiro não coloca o mapa no registro', () => {
    const { registro, loja } = mapaComRegistro();
    const outro = criarLojaMapa();
    outro.despachar({ tipo: 'ColocarTile', coord: A, terreno: 'terrenoMarcado' });
    loja.despachar({ tipo: 'CarregarMapa', estado: outro.obterEstado() });
    expect(JSON.stringify(registro.obterEntradas())).not.toContain('terrenoMarcado');
  });
});

describe('registro da posição do grupo', () => {
  it('registra autor e destino', () => {
    const registro = criarLojaRegistro();
    const loja = criarLojaGrupo(undefined, {
      obterAutorId: () => 'mestre',
      aoExecutar: registro.registrar,
    });
    loja.despachar({ tipo: 'PosicionarGrupo', coord: B });
    expect(registro.obterEntradas()[0]).toMatchObject({
      tipo: 'PosicionarGrupo',
      coord: B,
      autorId: 'mestre',
    });
  });
});
