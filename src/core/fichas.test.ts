import { describe, expect, it } from 'vitest';
import { aplicarAcaoCompendio, criarCompendioVazio, type EstadoCompendio } from './compendio';
import {
  calcularFicha,
  habilidadesDaFicha,
  proficienciaDoMonstro,
  proficienciasDaFicha,
  usosDaHabilidade,
} from './calculoDaFicha';
import { criarEntrada, type Entrada, type EntradaDe } from './entradas';
import {
  aplicarAcaoFichas,
  comClasse,
  comNivel,
  comOrigem,
  criarFicha,
  criarFichasVazias,
  criarLojaFichas,
  fichaDeMonstro,
  fichasEmOrdem,
  nivelTotal,
  pvPorNivel,
  semClasse,
  type Ficha,
} from './fichas';
import { criarLojaRegistro } from './registro';
import { REGRAS_PADRAO } from './regrasPadrao';

const furia: EntradaDe<'habilidade'> = {
  ...criarEntrada('habilidade', 'furia'),
  nome: 'Rage',
  dados: { requisito: 'Barbarian 1', usos: { maximo: 'tabela(furias)', recarga: 'descanso-longo' } },
};
const critico: EntradaDe<'habilidade'> = { ...criarEntrada('habilidade', 'critico'), nome: 'Brutal Critical' };
const barbaro: EntradaDe<'classe'> = {
  ...criarEntrada('classe', 'barbaro'),
  nome: 'Barbarian',
  dados: {
    dadoVida: 12,
    salvaguardas: ['for', 'con'],
    proficiencias: [],
    habilidades: [
      { nivel: 1, entradaId: 'furia' },
      { nivel: 9, entradaId: 'critico' },
    ],
    atributoConjuracao: null,
    tabela: [{ id: 'furias', nome: 'Fúrias', valores: ['2', '2', '3', '3', '3', '4', '4', '4', '4', '4', '4', '5', '5', '5', '5', '5', '6', '6', '6', 'ilimitado'] }],
  },
};
const mago: EntradaDe<'classe'> = {
  ...criarEntrada('classe', 'mago'),
  nome: 'Wizard',
  dados: { ...barbaro.dados, dadoVida: 6, salvaguardas: ['int', 'sab'], habilidades: [], atributoConjuracao: 'int', tabela: [] },
};
const visaoNoEscuro: EntradaDe<'habilidade'> = { ...criarEntrada('habilidade', 'visao'), nome: 'Darkvision' };
const anao: EntradaDe<'especie'> = {
  ...criarEntrada('especie', 'anao'),
  nome: 'Hill Dwarf',
  dados: { tamanho: 'medio', deslocamento: 25, aumentosAtributo: { con: 2, sab: 1 }, idiomas: [], tracos: ['visao'] },
};
const acolito: EntradaDe<'antecedente'> = {
  ...criarEntrada('antecedente', 'acolito'),
  nome: 'Acolyte',
  dados: { proficiencias: ['Skill: Insight', 'Skill: Religion', 'Idiomas à escolha'], habilidades: [] },
};
const goblin: EntradaDe<'monstro'> = {
  ...criarEntrada('monstro', 'goblin'),
  nome: 'Goblin',
  dados: {
    ...criarEntrada('monstro', 'x').dados,
    classeArmadura: 15,
    notaArmadura: 'Leather Armor, Shield',
    pontosVida: 7,
    dadosVida: '2d6',
    deslocamento: '30 ft.',
    atributos: { for: 8, des: 14, con: 10, int: 10, sab: 8, car: 8 },
    pericias: { Stealth: 6 },
    nivelDesafio: 0.25,
  },
};

const compendio: EstadoCompendio = [furia, critico, barbaro, mago, visaoNoEscuro, anao, acolito, goblin].reduce(
  (estado, entrada: Entrada) => aplicarAcaoCompendio(estado, { tipo: 'AdicionarEntrada', entrada }),
  criarCompendioVazio(),
);

function personagem(): Ficha {
  let ficha: Ficha = { ...criarFicha('personagem', 'f1'), nome: 'Brunhilde', atributos: { for: 16, des: 14, con: 14, int: 8, sab: 12, car: 10 } };
  ficha = comClasse(ficha, compendio, 'barbaro');
  ficha = comOrigem(ficha, compendio, 'especieId', 'anao');
  ficha = comOrigem(ficha, compendio, 'antecedenteId', 'acolito');
  return ficha;
}

const valor = (resultado: { ok: boolean; valor?: number }) => (resultado.ok ? resultado.valor : NaN);

describe('montar a ficha', () => {
  it('copia a classe e as habilidades dela', () => {
    const ficha = personagem();
    expect(ficha.classes).toEqual([{ entradaId: 'barbaro', nivel: 1 }]);
    expect(Object.keys(ficha.entradas).sort()).toEqual(['acolito', 'anao', 'barbaro', 'critico', 'furia', 'visao']);
  });

  it('a cópia não muda quando o compêndio muda', () => {
    const ficha = personagem();
    const editado = aplicarAcaoCompendio(compendio, { tipo: 'EditarEntrada', entrada: { ...barbaro, nome: 'Outro' } });
    expect(editado.entradas.barbaro.nome).toBe('Outro');
    expect(ficha.entradas.barbaro.nome).toBe('Barbarian');
  });

  it('não repete classe, ignora o que não é classe e respeita o nível 20', () => {
    const ficha = personagem();
    expect(comClasse(ficha, compendio, 'barbaro')).toBe(ficha);
    expect(comClasse(ficha, compendio, 'anao')).toBe(ficha);
    const nivel20 = comNivel(ficha, 'barbaro', 25);
    expect(nivelTotal(nivel20)).toBe(20);
    expect(comClasse(nivel20, compendio, 'mago')).toBe(nivel20);
  });

  it('com duas classes, o total não passa de 20', () => {
    let ficha = comClasse(comNivel(personagem(), 'barbaro', 5), compendio, 'mago');
    ficha = comNivel(ficha, 'mago', 30);
    expect(ficha.classes).toEqual([
      { entradaId: 'barbaro', nivel: 5 },
      { entradaId: 'mago', nivel: 15 },
    ]);
  });

  it('tirar a classe tira as cópias que só ela usava', () => {
    const ficha = semClasse(personagem(), 'barbaro');
    expect(ficha.classes).toEqual([]);
    expect(Object.keys(ficha.entradas).sort()).toEqual(['acolito', 'anao', 'visao']);
  });

  it('trocar ou tirar a espécie troca as cópias', () => {
    const ficha = comOrigem(personagem(), compendio, 'especieId', null);
    expect(ficha.especieId).toBeNull();
    expect('visao' in ficha.entradas).toBe(false);
    expect(comOrigem(ficha, compendio, 'especieId', 'barbaro')).toBe(ficha);
  });

  it('PV pela média, a menos que haja valor rolado', () => {
    const ficha = comNivel(personagem(), 'barbaro', 3);
    expect(pvPorNivel(ficha).map((n) => n.valor)).toEqual([12, 7, 7]);
    expect(pvPorNivel({ ...ficha, pvPorNivel: [null, 10] }).map((n) => n.valor)).toEqual([12, 10, 7]);
  });

  it('a primeira classe dá o dado cheio no 1º nível', () => {
    const ficha = comNivel(comClasse(personagem(), compendio, 'mago'), 'mago', 2);
    expect(pvPorNivel(ficha).map((n) => [n.dado, n.valor])).toEqual([
      [12, 12],
      [6, 4],
      [6, 4],
    ]);
  });
});

describe('cálculo da ficha', () => {
  it('soma a espécie aos atributos e mostra de onde veio', () => {
    const c = calcularFicha(personagem(), REGRAS_PADRAO);
    expect(c.valor('con')).toMatchObject({
      valor: 16,
      base: 14,
      ajustes: [{ fonte: 'Hill Dwarf', operacao: 'somar', valor: 2, aplicado: true }],
    });
    expect(valor(c.valor('sab'))).toBe(13);
  });

  it('calcula o personagem de nível 5', () => {
    const c = calcularFicha(comNivel(personagem(), 'barbaro', 5), REGRAS_PADRAO);
    expect(valor(c.valor('prof'))).toBe(3);
    expect(valor(c.valor('pv_maximos'))).toBe(12 + 4 * 7 + 5 * 3);
    expect(valor(c.valor('deslocamento'))).toBe(25);
    expect(valor(c.valor('salvaguarda_for'))).toBe(3 + 3);
    expect(valor(c.valor('intuicao'))).toBe(1 + 3);
    expect(c.valor('cd_magia').ok).toBe(false);
  });

  it('proficiências: salvaguardas da classe, perícias do antecedente, e as marcadas à mão valem mais', () => {
    const ficha = { ...personagem(), proficiencias: { atletismo: 2, intuicao: 0 } };
    expect(proficienciasDaFicha(ficha, REGRAS_PADRAO)).toEqual({
      salvaguarda_for: { valor: 1, origem: 'Barbarian' },
      salvaguarda_con: { valor: 1, origem: 'Barbarian' },
      religiao: { valor: 1, origem: 'Acolyte' },
      intuicao: { valor: 0, origem: 'marcada na ficha' },
      atletismo: { valor: 2, origem: 'marcada na ficha' },
    });
  });

  it('a conjuração vem da primeira classe que conjura', () => {
    const ficha = comClasse(personagem(), compendio, 'mago');
    expect(valor(calcularFicha(ficha, REGRAS_PADRAO).valor('cd_magia'))).toBe(8 + 2 - 1);
  });

  it('fichas sem classe contam como nível 1 e avisam que faltam os PV', () => {
    const c = calcularFicha(criarFicha('npc', 'n'), REGRAS_PADRAO);
    expect(valor(c.valor('prof'))).toBe(2);
    expect(c.valor('pv_maximos').ok).toBe(false);
  });
});

describe('habilidades', () => {
  it('lista as ganhas até o nível atual, com a origem', () => {
    const nomes = (ficha: Ficha) => habilidadesDaFicha(ficha).map((h) => `${h.entrada.nome} (${h.origem})`);
    expect(nomes(personagem())).toEqual(['Rage (Barbarian 1)', 'Darkvision (Hill Dwarf)']);
    expect(nomes(comNivel(personagem(), 'barbaro', 9))).toContain('Brutal Critical (Barbarian 9)');
  });

  it('usos leem a tabela da classe no nível atual', () => {
    const usos = (nivel: number) => {
      const ficha = comNivel(personagem(), 'barbaro', nivel);
      const resultado = usosDaHabilidade(calcularFicha(ficha, REGRAS_PADRAO), habilidadesDaFicha(ficha)[0]);
      return resultado?.ok ? resultado.valor : resultado?.erro;
    };
    expect([1, 3, 6, 20].map(usos)).toEqual([2, 3, 4, Infinity]);
  });
});

describe('monstros', () => {
  it('usam CA, PV, perícias e proficiência da ficha do monstro', () => {
    const ficha = fichaDeMonstro(goblin, 'm1');
    expect(ficha).toMatchObject({ tipo: 'monstro', nome: 'Goblin', monstroId: 'goblin', donoId: 'mestre' });
    const c = calcularFicha(ficha, REGRAS_PADRAO);
    expect(c.valor('ca')).toMatchObject({ valor: 15, partes: [{ texto: 'ficha do monstro (Leather Armor, Shield)' }] });
    expect(valor(c.valor('pv_maximos'))).toBe(7);
    expect(valor(c.valor('furtividade'))).toBe(6);
    expect(valor(c.valor('acrobacia'))).toBe(2);
    expect(valor(c.valor('deslocamento'))).toBe(30);
    expect(valor(c.valor('prof'))).toBe(2);
  });

  it('proficiência pelo nível de desafio', () => {
    expect([0, 0.5, 1, 4, 5, 9, 17, 30].map(proficienciaDoMonstro)).toEqual([2, 2, 2, 2, 3, 4, 6, 9]);
  });
});

describe('loja de fichas', () => {
  it('cria, edita, remove e lista em ordem', () => {
    const a = { ...criarFicha('personagem', 'a'), nome: 'Zuleica' };
    const b = { ...criarFicha('npc', 'b'), nome: 'Ana' };
    let estado = aplicarAcaoFichas(criarFichasVazias(), { tipo: 'CriarFicha', ficha: a });
    estado = aplicarAcaoFichas(estado, { tipo: 'CriarFicha', ficha: b });
    expect(fichasEmOrdem(estado).map((f) => f.nome)).toEqual(['Ana', 'Zuleica']);
    expect(aplicarAcaoFichas(estado, { tipo: 'CriarFicha', ficha: a })).toBe(estado);
    const editado = aplicarAcaoFichas(estado, { tipo: 'EditarFicha', ficha: { ...a, nome: 'Zu' } });
    expect(editado.fichas.a.nome).toBe('Zu');
    expect(aplicarAcaoFichas(estado, { tipo: 'EditarFicha', ficha: { ...a, tipo: 'npc' } })).toBe(estado);
    expect(aplicarAcaoFichas(estado, { tipo: 'RemoverFicha', fichaId: 'a' }).fichas).toEqual({ b });
  });

  it('desfaz e registra sem guardar textos', () => {
    const registro = criarLojaRegistro();
    const loja = criarLojaFichas(undefined, { obterAutorId: () => 'mestre', aoExecutar: registro.registrar });
    loja.despachar({ tipo: 'CriarFicha', ficha: { ...criarFicha('personagem', 'a'), nome: 'Segredo' } });
    loja.desfazer();
    expect(loja.obterEstado().fichas).toEqual({});
    expect(registro.obterEntradas().map((e) => e.tipo)).toEqual(['CriarFicha', 'DesfazerFichas']);
    expect(JSON.stringify(registro.obterEntradas())).not.toContain('Segredo');
  });
});
