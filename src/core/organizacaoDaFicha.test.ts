import { describe, expect, it } from 'vitest';
import { aplicarAcaoCompendio, criarCompendioVazio, type EstadoCompendio } from './compendio';
import { criarEntrada, type Entrada, type EntradaDe } from './entradas';
import {
  comClasse,
  comCopiaEditada,
  comExtra,
  comItem,
  comItemAvulso,
  comMoeda,
  comNota,
  comPilha,
  comSecao,
  comSecaoMovida,
  comSecaoRenomeada,
  criarFicha,
  semExtra,
  semNota,
  semPilha,
  semSecao,
  type Ficha,
} from './fichas';
import { comCartaMovida, pesoCarregado, secoesOrganizadas } from './organizacaoDaFicha';
import { REGRAS_PADRAO } from './regrasPadrao';

const item = (id: string, nome: string, peso: number): EntradaDe<'item'> => ({
  ...criarEntrada('item', id),
  nome,
  dados: { ...criarEntrada('item', id).dados, peso },
});
const espada = item('espada', 'Longsword', 1.5);
const corda = item('corda', 'Rope', 5);
const bolaDeFogo: EntradaDe<'magia'> = { ...criarEntrada('magia', 'bola'), nome: 'Fireball' };
const furia: EntradaDe<'habilidade'> = { ...criarEntrada('habilidade', 'furia'), nome: 'Rage' };
const sorte: EntradaDe<'talento'> = { ...criarEntrada('talento', 'sorte'), nome: 'Lucky' };
const barbaro: EntradaDe<'classe'> = {
  ...criarEntrada('classe', 'barbaro'),
  nome: 'Barbarian',
  dados: { ...criarEntrada('classe', 'x').dados, dadoVida: 12, habilidades: [{ nivel: 1, entradaId: 'furia' }] },
};

const compendio: EstadoCompendio = [espada, corda, bolaDeFogo, furia, sorte, barbaro, criarEntrada('monstro', 'goblin')].reduce(
  (estado, entrada: Entrada) => aplicarAcaoCompendio(estado, { tipo: 'AdicionarEntrada', entrada }),
  criarCompendioVazio(),
);

function heroi(): Ficha {
  let ficha = comClasse(criarFicha('personagem', 'h'), compendio, 'barbaro');
  ficha = comItem(ficha, compendio, 'espada', 'p-espada');
  ficha = comItem(ficha, compendio, 'corda', 'p-corda', 2);
  ficha = comExtra(ficha, compendio, 'bola');
  ficha = comNota(ficha, { id: 'n1', titulo: 'Plano', texto: 'Achar o mapa.' });
  return ficha;
}

const mapa = (ficha: Ficha) =>
  Object.fromEntries(secoesOrganizadas(ficha).map((s) => [s.secao.id, s.cartas.map((c) => c.chave)]));

describe('inventário', () => {
  it('acrescenta itens do compêndio em pilhas, copiando o item', () => {
    const ficha = heroi();
    expect(ficha.itens.map((p) => [p.entradaId, p.quantidade])).toEqual([
      ['espada', 1],
      ['corda', 2],
    ]);
    expect(ficha.entradas.espada).toEqual(espada);
    expect(comItem(ficha, compendio, 'bola', 'x')).toBe(ficha);
  });

  it('a mesma entrada pode ter várias pilhas, e a cópia editada é reaproveitada', () => {
    const editada = comCopiaEditada(heroi(), { ...espada, nome: 'Espada do avô' });
    const ficha = comItem(editada, compendio, 'espada', 'p-espada-2');
    expect(ficha.itens.filter((p) => p.entradaId === 'espada')).toHaveLength(2);
    expect(ficha.entradas.espada.nome).toBe('Espada do avô');
  });

  it('item avulso existe só na ficha', () => {
    const ficha = comItemAvulso(heroi(), 'tocha', 'p-tocha', 'Tocha velha');
    expect(ficha.entradas.tocha).toMatchObject({ tipo: 'item', nome: 'Tocha velha', origem: { tipo: 'campanha' } });
    expect('tocha' in compendio.entradas).toBe(false);
  });

  it('quantidade fica entre 1 e 99999; marcas são guardadas', () => {
    let ficha = comPilha(heroi(), 'p-corda', { quantidade: 0 });
    expect(ficha.itens[1].quantidade).toBe(1);
    ficha = comPilha(ficha, 'p-espada', { equipado: true, quantidade: 3.6 });
    expect(ficha.itens[0]).toMatchObject({ equipado: true, quantidade: 4 });
  });

  it('descartar tira a pilha, e a cópia some quando nenhuma pilha a usa', () => {
    let ficha = comItem(heroi(), compendio, 'espada', 'p-espada-2');
    ficha = semPilha(ficha, 'p-espada');
    expect('espada' in ficha.entradas).toBe(true);
    ficha = semPilha(ficha, 'p-espada-2');
    expect('espada' in ficha.entradas).toBe(false);
  });

  it('peso: itens vezes quantidade, mais as moedas pela regra', () => {
    const ficha = comMoeda(heroi(), 'po', 100);
    expect(pesoCarregado(ficha, REGRAS_PADRAO)).toEqual({ itens: 1.5 + 2 * 5, moedas: 1, total: 12.5 });
    expect(pesoCarregado(ficha, { ...REGRAS_PADRAO, pesoPorMoeda: 0 }).moedas).toBe(0);
  });
});

describe('extras e notas', () => {
  it('acrescenta habilidades, magias e talentos, mas não outros tipos', () => {
    let ficha = comExtra(heroi(), compendio, 'sorte');
    expect(ficha.extras).toEqual(['bola', 'sorte']);
    expect(comExtra(ficha, compendio, 'goblin')).toBe(ficha);
    expect(comExtra(ficha, compendio, 'bola')).toBe(ficha);
    ficha = semExtra(ficha, 'bola');
    expect('bola' in ficha.entradas).toBe(false);
  });

  it('notas são criadas, editadas e apagadas', () => {
    let ficha = comNota(heroi(), { id: 'n1', titulo: 'Plano', texto: 'Mudou.' });
    expect(ficha.notas).toEqual([{ id: 'n1', titulo: 'Plano', texto: 'Mudou.' }]);
    ficha = semNota(ficha, 'n1');
    expect(ficha.notas).toEqual([]);
  });
});

describe('organização', () => {
  it('cartas ainda não arrumadas vão para a seção padrão do tipo', () => {
    const ficha = comPilha(heroi(), 'p-espada', { equipado: true });
    expect(mapa(ficha)).toEqual({
      equipado: ['item:p-espada'],
      mochila: ['item:p-corda'],
      habilidades: ['entrada:furia'],
      magias: ['entrada:bola'],
      notas: ['nota:n1'],
    });
  });

  it('move uma carta para outra seção e para outra posição', () => {
    let ficha = comSecao(heroi(), 'cinto', 'Cinto');
    ficha = comCartaMovida(ficha, 'item:p-corda', 'cinto', 0);
    ficha = comCartaMovida(ficha, 'entrada:bola', 'cinto', 0);
    expect(mapa(ficha).cinto).toEqual(['entrada:bola', 'item:p-corda']);
    expect(mapa(ficha).mochila).toEqual(['item:p-espada']);
    ficha = comCartaMovida(ficha, 'entrada:bola', 'cinto', 2);
    expect(mapa(ficha).cinto).toEqual(['item:p-corda', 'entrada:bola']);
  });

  it('uma habilidade nova aparece sozinha mesmo depois de arrumar tudo', () => {
    let ficha = comCartaMovida(heroi(), 'nota:n1', 'mochila', 0);
    ficha = comExtra(ficha, compendio, 'sorte');
    expect(mapa(ficha).habilidades).toEqual(['entrada:furia', 'entrada:sorte']);
  });

  it('cartas descartadas somem das seções', () => {
    let ficha = comCartaMovida(heroi(), 'item:p-corda', 'magias', 0);
    ficha = semPilha(ficha, 'p-corda');
    expect(ficha.secoes.flatMap((s) => s.cartas)).not.toContain('item:p-corda');
  });

  it('seções podem ser criadas, renomeadas, movidas e apagadas; as cartas vão para a primeira', () => {
    let ficha = comSecao(heroi(), 'cinto', 'Cinto');
    ficha = comSecaoRenomeada(ficha, 'cinto', 'Cinturão');
    ficha = comSecaoMovida(ficha, 'cinto', 0);
    expect(ficha.secoes.map((s) => s.nome)).toEqual(['Cinturão', 'Equipado', 'Mochila', 'Habilidades', 'Magias', 'Notas']);
    ficha = comCartaMovida(ficha, 'item:p-corda', 'cinto', 0);
    ficha = semSecao(ficha, 'cinto');
    expect(mapa(ficha).equipado).toEqual(['item:p-corda']);
  });

  it('apagar a seção padrão manda as cartas soltas para a primeira seção; a última não pode ser apagada', () => {
    let ficha = semSecao(heroi(), 'magias');
    expect(mapa(ficha).equipado).toContain('entrada:bola');
    for (const id of ['equipado', 'mochila', 'habilidades', 'notas']) {
      ficha = semSecao(ficha, id);
    }
    expect(ficha.secoes).toHaveLength(1);
    expect(semSecao(ficha, 'notas')).toBe(ficha);
    expect(mapa(ficha).notas).toHaveLength(5);
  });
});
