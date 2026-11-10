import { describe, expect, it } from 'vitest';
import {
  acoesDaArma,
  conjurar,
  descansoCurto,
  descansoLongo,
  espacosDeMagia,
  executarAcao,
  gastarUso,
  habilidadeNaFicha,
  proficienteComArma,
  rolarTeste,
  transferirItem,
  transferirMoedas,
  usosDaHabilidadeNaFicha,
} from './acoesDaFicha';
import { calcularFicha } from './calculoDaFicha';
import { aplicarAcaoCompendio, criarCompendioVazio, type EstadoCompendio } from './compendio';
import { criarEntrada, type DadosArma, type Entrada, type EntradaDe } from './entradas';
import { comClasse, comCopiaEditada, comItem, comMoeda, comNivel, comPilha, criarFicha, type Ficha } from './fichas';
import { naturalDaRolagem } from './rolagens';
import { REGRAS_PADRAO } from './regrasPadrao';

/** Sempre o mesmo resultado: 0.5 dá 11 num d20, 4 num d6. */
const meio = () => 0.5;
/** O maior resultado em qualquer dado. */
const maximo = () => 0.9999;

const furia: EntradaDe<'habilidade'> = {
  ...criarEntrada('habilidade', 'furia'),
  nome: 'Rage',
  dados: { requisito: '', usos: { maximo: 'tabela(furias)', recarga: 'descanso-longo' } },
};
const folego: EntradaDe<'habilidade'> = {
  ...criarEntrada('habilidade', 'folego'),
  nome: 'Second Wind',
  dados: { requisito: '', usos: { maximo: '1', recarga: 'descanso-curto' } },
  acoes: [{ id: 'a', rotulo: 'Recuperar', passos: [{ tipo: 'gastarUso', quantidade: 1 }, { tipo: 'curar', formula: '1d10 + nivel_classe' }] }],
};
const guerreiro: EntradaDe<'classe'> = {
  ...criarEntrada('classe', 'guerreiro'),
  nome: 'Fighter',
  dados: {
    ...criarEntrada('classe', 'x').dados,
    dadoVida: 10,
    proficiencias: ['Simple Weapons', 'Martial Weapons'],
    habilidades: [
      { nivel: 1, entradaId: 'furia' },
      { nivel: 1, entradaId: 'folego' },
    ],
    tabela: [{ id: 'furias', nome: 'Fúrias', valores: Array(20).fill('2') }],
  },
};
const mago: EntradaDe<'classe'> = {
  ...criarEntrada('classe', 'mago'),
  nome: 'Wizard',
  dados: {
    ...criarEntrada('classe', 'x').dados,
    dadoVida: 6,
    atributoConjuracao: 'int',
    tabela: [
      { id: 'espacos_1', nome: '1º', valores: ['2', '3', '4', ...Array(17).fill('4')] },
      { id: 'espacos_2', nome: '2º', valores: ['0', '0', '2', ...Array(17).fill('3')] },
    ],
  },
};
const arma = (id: string, nome: string, a: Partial<DadosArma>): EntradaDe<'item'> => ({
  ...criarEntrada('item', id),
  nome,
  dados: {
    ...criarEntrada('item', id).dados,
    arma: { dominio: 'marcial', alcanceTipo: 'corpo-a-corpo', dano: '1d8', tipoDano: 'Slashing', danoVersatil: null, alcance: null, propriedades: [], ...a },
  },
});
const espada = arma('espada', 'Longsword', { danoVersatil: '1d10' });
const rapieira = arma('rapieira', 'Rapier', { propriedades: ['Finesse'] });
const arco = arma('arco', 'Longbow', { alcanceTipo: 'distancia', alcance: { normal: 45, longo: 180 } });
const pocao: EntradaDe<'item'> = {
  ...criarEntrada('item', 'pocao'),
  nome: 'Potion of Healing',
  acoes: [{ id: 'beber', rotulo: 'Beber', passos: [{ tipo: 'curar', formula: '2d4 + 2' }, { tipo: 'consumir', quantidade: 1 }] }],
};
const misseis: EntradaDe<'magia'> = {
  ...criarEntrada('magia', 'misseis'),
  nome: 'Magic Missile',
  dados: { ...criarEntrada('magia', 'x').dados, nivel: 1 },
  acoes: [{ id: 'd', rotulo: 'Dano', passos: [{ tipo: 'rolar', formula: '(nivel_espaco + 2)d4 + nivel_espaco + 2', rotulo: 'Dano' }] }],
};
const luz: EntradaDe<'magia'> = { ...criarEntrada('magia', 'luz'), nome: 'Light', dados: { ...criarEntrada('magia', 'x').dados, nivel: 0 } };

const compendio: EstadoCompendio = [furia, folego, guerreiro, mago, espada, rapieira, arco, pocao, misseis, luz].reduce(
  (estado, entrada: Entrada) => aplicarAcaoCompendio(estado, { tipo: 'AdicionarEntrada', entrada }),
  criarCompendioVazio(),
);

function lutador(nivel = 1): Ficha {
  let ficha: Ficha = { ...criarFicha('personagem', 'f'), nome: 'Ana', atributos: { for: 16, des: 14, con: 14, int: 10, sab: 12, car: 8 } };
  ficha = comNivel(comClasse(ficha, compendio, 'guerreiro'), 'guerreiro', nivel);
  return ficha;
}

const calcular = (ficha: Ficha) => calcularFicha(ficha, REGRAS_PADRAO);

describe('testes de d20', () => {
  it('soma o bônus ao d20 e explica a fórmula com os números', () => {
    const ficha = lutador();
    const r = rolarTeste(calcular(ficha), 'atletismo', 'Atletismo', 'normal', meio);
    expect(r.ok && [r.feita.rotulo, r.feita.formula, r.feita.rolagem.total]).toEqual(['Atletismo', '1d20 + 3', 11 + 3]);
  });

  it('vantagem fica com o maior dos dois d20; desvantagem, com o menor', () => {
    let i = 0;
    const alternado = () => [0.1, 0.9][i++ % 2];
    const c = calcular(lutador());
    const v = rolarTeste(c, 'mod(FOR)', 'Força', 'vantagem', alternado);
    expect(v.ok && [v.feita.rotulo, v.feita.rolagem.total]).toEqual(['Força (vantagem)', 19 + 3]);
    const d = rolarTeste(c, 'mod(FOR)', 'Força', 'desvantagem', alternado);
    expect(d.ok && d.feita.rolagem.total).toBe(3 + 3);
  });

  it('o 20 natural aparece no registro', () => {
    const r = rolarTeste(calcular(lutador()), 'iniciativa', 'Iniciativa', 'normal', maximo);
    expect(r.ok && naturalDaRolagem(r.feita.rolagem.dados)).toBe(20);
  });
});

describe('armas', () => {
  it('ataque com Força e proficiência; dano com Força', () => {
    const ficha = lutador();
    const [ataque, dano, versatil] = acoesDaArma(ficha, espada);
    expect(ataque.passos[0]).toMatchObject({ formula: '1d20 + mod(FOR) + prof', rotulo: 'Longsword: ataque' });
    expect(dano.passos[0]).toMatchObject({ formula: '1d8 + mod(FOR)', rotulo: 'Longsword: dano (slashing)' });
    expect(versatil.rotulo).toBe('Dano com as duas mãos');
  });

  it('Finesse usa o melhor atributo; à distância usa Destreza; sem proficiência não soma prof', () => {
    expect(acoesDaArma(lutador(), rapieira)[0].passos[0]).toMatchObject({ formula: '1d20 + max(mod(FOR), mod(DES)) + prof' });
    const semClasse = criarFicha('npc', 'n');
    expect(proficienteComArma(semClasse, arco)).toBe(false);
    expect(acoesDaArma(semClasse, arco)[0].passos[0]).toMatchObject({ formula: '1d20 + mod(DES)' });
  });

  it('crítico rola os dados de dano em dobro', () => {
    const ficha = lutador();
    const dano = acoesDaArma(ficha, espada)[1];
    const normal = executarAcao(ficha, calcular(ficha), dano, {}, { aleatorio: maximo });
    const critico = executarAcao(ficha, calcular(ficha), dano, {}, { aleatorio: maximo, critico: true });
    expect(normal.ok && normal.rolagens[0].rolagem.total).toBe(8 + 3);
    expect(critico.ok && [critico.rolagens[0].rotulo, critico.rolagens[0].rolagem.total]).toEqual(['Longsword: dano (slashing) (crítico)', 16 + 3]);
  });
});

describe('itens e habilidades', () => {
  it('beber a poção cura e gasta uma unidade; a última some', () => {
    let ficha = comPilha(comItem(lutador(), compendio, 'pocao', 'p1'), 'p1', { quantidade: 2 });
    ficha = { ...ficha, pvAtuais: 3 };
    const r = executarAcao(ficha, calcular(ficha), pocao.acoes[0], { pilhaId: 'p1' }, { aleatorio: meio });
    expect(r.ok && [r.ficha.pvAtuais, r.ficha.itens[0].quantidade]).toEqual([3 + 3 + 3 + 2, 1]);
    const ultima = executarAcao(r.ok ? r.ficha : ficha, calcular(ficha), pocao.acoes[0], { pilhaId: 'p1' }, { aleatorio: meio });
    expect(ultima.ok && ultima.ficha.itens).toEqual([]);
  });

  it('cura não passa do máximo (os PV voltam a ficar cheios)', () => {
    const ficha = { ...comItem(lutador(), compendio, 'pocao', 'p1'), pvAtuais: 11 };
    const r = executarAcao(ficha, calcular(ficha), pocao.acoes[0], { pilhaId: 'p1' }, { aleatorio: maximo });
    expect(r.ok && r.ficha.pvAtuais).toBeNull();
  });

  it('usar a Fúria gasta um uso; sem usos, nada acontece', () => {
    let ficha = lutador();
    const rage = habilidadeNaFicha(ficha, 'furia')!;
    for (const esperado of [1, 2]) {
      const r = gastarUso(ficha, calcular(ficha), rage);
      expect(r.ok && r.ficha.usosGastos.furia).toBe(esperado);
      ficha = r.ok ? r.ficha : ficha;
    }
    expect(gastarUso(ficha, calcular(ficha), rage)).toEqual({ ok: false, erro: 'Sem usos de Rage: restam 0.' });
    expect(usosDaHabilidadeNaFicha(ficha, calcular(ficha), rage)).toEqual({ ok: true, usos: { maximo: 2, gastos: 2, restantes: 0 } });
  });

  it('ações de habilidade usam o nível da classe, e gastam usos', () => {
    const ficha = { ...lutador(3), pvAtuais: 1 };
    const folegoNaFicha = habilidadeNaFicha(ficha, 'folego')!;
    const r = executarAcao(ficha, calcular(ficha), folego.acoes[0], { habilidade: folegoNaFicha }, { aleatorio: meio });
    expect(r.ok && [r.rolagens[0].formula, r.ficha.pvAtuais, r.ficha.usosGastos.folego]).toEqual(['1d10 + 3', 1 + 6 + 3, 1]);
  });

  it('descanso curto devolve só os usos de descanso curto; o longo devolve tudo', () => {
    const ficha: Ficha = { ...lutador(), usosGastos: { furia: 2, folego: 1 }, espacosGastos: [1, 0, 0, 0, 0, 0, 0, 0, 0], pvAtuais: 4 };
    expect(descansoCurto(ficha).usosGastos).toEqual({ furia: 2 });
    expect(descansoLongo(ficha)).toMatchObject({ usosGastos: {}, espacosGastos: [0, 0, 0, 0, 0, 0, 0, 0, 0], pvAtuais: null });
  });
});

describe('magias', () => {
  const maga = (nivel: number): Ficha => {
    const ficha = comNivel(comClasse({ ...criarFicha('personagem', 'm'), atributos: { ...criarFicha('personagem', 'm').atributos, int: 16 } }, compendio, 'mago'), 'mago', nivel);
    return { ...ficha, entradas: { ...ficha.entradas, misseis, luz } };
  };

  it('os espaços vêm da tabela da classe conjuradora', () => {
    expect(espacosDeMagia(maga(3), calcular(maga(3))).slice(0, 3)).toEqual([
      { nivel: 1, maximo: 4, gastos: 0 },
      { nivel: 2, maximo: 2, gastos: 0 },
      { nivel: 3, maximo: 0, gastos: 0 },
    ]);
  });

  it('conjurar gasta um espaço e rola com o nível do espaço', () => {
    const ficha = maga(3);
    const r = conjurar(ficha, calcular(ficha), misseis, 2, meio);
    expect(r.ok && [r.ficha.espacosGastos.slice(0, 2), r.rolagens[0].formula]).toEqual([[0, 1], '4d4 + 4']);
  });

  it('sem espaço do nível, não conjura; truques não gastam espaço', () => {
    const ficha = maga(1);
    expect(conjurar(ficha, calcular(ficha), misseis, 2)).toEqual({ ok: false, erro: 'Sem espaços de magia de 2º nível.' });
    const truque = conjurar(ficha, calcular(ficha), luz, 0);
    expect(truque.ok && truque.ficha.espacosGastos).toEqual(ficha.espacosGastos);
  });
});

describe('presentear', () => {
  const ana = () => comPilha(comItem(lutador(), compendio, 'pocao', 'p1'), 'p1', { quantidade: 3 });
  const bia = (): Ficha => ({ ...criarFicha('personagem', 'b'), nome: 'Bia' });
  let n = 0;
  const id = () => `novo-${++n}`;

  it('passa parte de uma pilha, e quem recebe ganha a cópia', () => {
    const resultado = transferirItem(ana(), bia(), 'p1', 2, id);
    expect(resultado).not.toBeNull();
    const [origem, destino] = resultado!;
    expect(origem.itens[0].quantidade).toBe(1);
    expect(destino.itens).toMatchObject([{ entradaId: 'pocao', quantidade: 2, equipado: false }]);
    expect(destino.entradas.pocao).toEqual(pocao);
  });

  it('a pilha inteira some de quem deu, e junta numa pilha igual de quem recebe', () => {
    const [, primeiro] = transferirItem(ana(), bia(), 'p1', 1, id)!;
    const [origem, destino] = transferirItem(ana(), primeiro, 'p1', 3, id)!;
    expect(origem.itens).toEqual([]);
    expect(destino.itens).toHaveLength(1);
    expect(destino.itens[0].quantidade).toBe(4);
  });

  it('cópias diferentes do mesmo item convivem com ids diferentes', () => {
    const destino = comCopiaEditada(comItem(bia(), compendio, 'pocao', 'pb'), { ...pocao, nome: 'Poção da Bia' });
    const [, novo] = transferirItem(ana(), destino, 'p1', 1, id)!;
    expect(Object.values(novo.entradas).map((e) => e.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'))).toEqual([
      'Poção da Bia',
      'Potion of Healing',
    ]);
    expect(novo.itens).toHaveLength(2);
  });

  it('moedas só passam se houver o bastante', () => {
    const rica = comMoeda(ana(), 'po', 10);
    expect(transferirMoedas(rica, bia(), 'po', 11)).toBeNull();
    const [a, b] = transferirMoedas(rica, bia(), 'po', 4)!;
    expect([a.moedas.po, b.moedas.po]).toEqual([6, 4]);
  });
});
