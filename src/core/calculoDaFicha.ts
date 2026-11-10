/**
 * Transforma uma ficha no que a calculadora precisa: nível, PV dos dados de vida,
 * deslocamento, conjuração, proficiências e efeitos, cada um com a sua origem.
 */
import { criarCalculo, type Calculo, type EfeitoAtivo, type EntradaDoCalculo } from './calculadora';
import { ATRIBUTOS, type Atributo, type EntradaDe } from './entradas';
import { entradaDaFicha, nivelTotal, pvPorNivel, type Ficha } from './fichas';
import type { ResultadoFormula } from './formulas';
import { encontrarPericia, idSalvaguarda, type Regras } from './regras';

export interface ProficienciaDaFicha {
  readonly valor: number;
  /** De onde veio: o nome da classe, do antecedente ou "marcada na ficha". */
  readonly origem: string;
}

/** Proficiências que vêm sozinhas: salvaguardas da primeira classe e perícias do antecedente. */
export function proficienciasAutomaticas(ficha: Ficha, regras: Regras): Record<string, ProficienciaDaFicha> {
  const resultado: Record<string, ProficienciaDaFicha> = {};
  const primeira = ficha.classes[0] ? entradaDaFicha(ficha, ficha.classes[0].entradaId, 'classe') : null;
  for (const atributo of primeira?.dados.salvaguardas ?? []) {
    resultado[idSalvaguarda(atributo)] = { valor: 1, origem: primeira!.nome };
  }
  const antecedente = entradaDaFicha(ficha, ficha.antecedenteId, 'antecedente');
  for (const texto of antecedente?.dados.proficiencias ?? []) {
    const pericia = encontrarPericia(regras, texto);
    if (pericia) {
      resultado[pericia] = { valor: 1, origem: antecedente!.nome };
    }
  }
  return resultado;
}

/** Todas as proficiências da ficha: as marcadas à mão valem mais que as automáticas. */
export function proficienciasDaFicha(ficha: Ficha, regras: Regras): Record<string, ProficienciaDaFicha> {
  const resultado = proficienciasAutomaticas(ficha, regras);
  for (const [id, valor] of Object.entries(ficha.proficiencias)) {
    resultado[id] = { valor, origem: 'marcada na ficha' };
  }
  return resultado;
}

/** Os aumentos da espécie e os efeitos "sempre" das entradas em uso viram efeitos ativos. */
export function efeitosDaFicha(ficha: Ficha): EfeitoAtivo[] {
  const efeitos: EfeitoAtivo[] = [];
  const especie = entradaDaFicha(ficha, ficha.especieId, 'especie');
  if (especie) {
    for (const [atributo, aumento] of Object.entries(especie.dados.aumentosAtributo)) {
      efeitos.push({
        fonte: especie.nome || 'Espécie',
        efeito: { id: `especie-${atributo}`, alvo: atributo, operacao: 'somar', valor: String(aumento), quando: 'sempre' },
      });
    }
  }
  // Por enquanto só os efeitos permanentes; equipar e sintonizar entram no passo dos itens.
  for (const { entrada } of entradasEmUso(ficha)) {
    for (const efeito of entrada.efeitos) {
      if (efeito.quando === 'sempre') {
        efeitos.push({ fonte: entrada.nome || 'Sem nome', efeito });
      }
    }
  }
  return efeitos;
}

/** O bônus de proficiência de um monstro pelo nível de desafio, como na tabela dos livros. */
export function proficienciaDoMonstro(nivelDesafio: number): number {
  return nivelDesafio < 1 ? 2 : 2 + Math.floor((nivelDesafio - 1) / 4);
}

function fixosDoMonstro(monstro: EntradaDe<'monstro'>, regras: Regras): EntradaDoCalculo['fixos'] {
  const origem = 'ficha do monstro';
  const d = monstro.dados;
  const fixos: Record<string, { valor: number; origem: string }> = {
    ca: { valor: d.classeArmadura, origem: d.notaArmadura ? `ficha do monstro (${d.notaArmadura})` : origem },
    pv_maximos: { valor: d.pontosVida, origem: `ficha do monstro (${d.dadosVida})` },
    prof: { valor: proficienciaDoMonstro(d.nivelDesafio), origem: `nível de desafio` },
  };
  // O primeiro número do texto, como o 10,5 de "10,5 m, fly 18 m".
  const deslocamento = /\d+(?:[.,]\d+)?/.exec(d.deslocamento);
  if (deslocamento) {
    fixos.deslocamento = { valor: Number(deslocamento[0].replace(',', '.')), origem: d.deslocamento };
  }
  for (const [atributo, valor] of Object.entries(d.salvaguardas) as [Atributo, number][]) {
    fixos[idSalvaguarda(atributo)] = { valor, origem };
  }
  for (const [nome, valor] of Object.entries(d.pericias)) {
    const pericia = encontrarPericia(regras, nome);
    if (pericia) {
      fixos[pericia] = { valor, origem };
    }
  }
  return fixos;
}

export function entradaDoCalculo(ficha: Ficha, regras: Regras): EntradaDoCalculo {
  const monstro = entradaDaFicha(ficha, ficha.monstroId, 'monstro');
  const proficiencias = Object.fromEntries(
    Object.entries(proficienciasDaFicha(ficha, regras)).map(([id, p]) => [id, p.valor]),
  );
  const niveis = pvPorNivel(ficha);
  const especie = entradaDaFicha(ficha, ficha.especieId, 'especie');
  const conjuradora = ficha.classes
    .map((c) => entradaDaFicha(ficha, c.entradaId, 'classe'))
    .find((c) => c?.dados.atributoConjuracao);
  return {
    atributos: ficha.atributos,
    // Fichas sem classe, como a de muitos NPCs, contam como nível 1.
    nivel: Math.max(1, nivelTotal(ficha)),
    pvDosDados: niveis.length > 0 ? niveis.reduce((s, n) => s + n.valor, 0) : undefined,
    deslocamentoBase: especie?.dados.deslocamento,
    conjuracao: conjuradora?.dados.atributoConjuracao ?? null,
    proficiencias,
    efeitos: efeitosDaFicha(ficha),
    fixos: monstro ? fixosDoMonstro(monstro, regras) : undefined,
  };
}

export function calcularFicha(ficha: Ficha, regras: Regras): Calculo {
  return criarCalculo(regras, entradaDoCalculo(ficha, regras));
}

/** Uma habilidade da ficha, com de onde ela vem. */
export interface HabilidadeNaFicha {
  readonly entrada: EntradaDe<'habilidade'>;
  /** Como "Barbarian 1", "Hill Dwarf" ou "Acolyte". */
  readonly origem: string;
  /** Quando vem de uma classe: a classe e o nível nela, para fórmulas como `tabela(furias)`. */
  readonly classe: { readonly entrada: EntradaDe<'classe'>; readonly nivel: number } | null;
}

/** As entradas que a ficha usa agora: classes, espécie, antecedente e as habilidades já ganhas. */
function entradasEmUso(ficha: Ficha): { entrada: EntradaDe<'classe' | 'especie' | 'antecedente' | 'habilidade'> }[] {
  const lista: { entrada: EntradaDe<'classe' | 'especie' | 'antecedente' | 'habilidade'> }[] = [];
  for (const c of ficha.classes) {
    const classe = entradaDaFicha(ficha, c.entradaId, 'classe');
    if (classe) {
      lista.push({ entrada: classe });
    }
  }
  const especie = entradaDaFicha(ficha, ficha.especieId, 'especie');
  if (especie) {
    lista.push({ entrada: especie });
  }
  const antecedente = entradaDaFicha(ficha, ficha.antecedenteId, 'antecedente');
  if (antecedente) {
    lista.push({ entrada: antecedente });
  }
  for (const h of habilidadesDaFicha(ficha)) {
    lista.push({ entrada: h.entrada });
  }
  return lista;
}

/** As habilidades que a ficha já tem: as das classes até o nível atual, da espécie e do antecedente. */
export function habilidadesDaFicha(ficha: Ficha): HabilidadeNaFicha[] {
  const lista: HabilidadeNaFicha[] = [];
  const vistas = new Set<string>();
  for (const c of ficha.classes) {
    const classe = entradaDaFicha(ficha, c.entradaId, 'classe');
    if (!classe) {
      continue;
    }
    const ganhas = classe.dados.habilidades
      .filter((h) => h.nivel <= c.nivel)
      .sort((a, b) => a.nivel - b.nivel);
    for (const h of ganhas) {
      const entrada = entradaDaFicha(ficha, h.entradaId, 'habilidade');
      // Uma habilidade ganha em vários níveis (como Aumento de Atributo) aparece uma vez só.
      if (entrada && !vistas.has(entrada.id)) {
        vistas.add(entrada.id);
        lista.push({ entrada, origem: `${classe.nome} ${h.nivel}`, classe: { entrada: classe, nivel: c.nivel } });
      }
    }
  }
  for (const [id, tipo] of [
    [ficha.especieId, 'especie'],
    [ficha.antecedenteId, 'antecedente'],
  ] as const) {
    const origem = entradaDaFicha(ficha, id, tipo);
    const citadas = origem ? (origem.tipo === 'especie' ? origem.dados.tracos : origem.dados.habilidades) : [];
    for (const habilidadeId of citadas) {
      const entrada = entradaDaFicha(ficha, habilidadeId, 'habilidade');
      if (entrada && !vistas.has(entrada.id)) {
        vistas.add(entrada.id);
        lista.push({ entrada, origem: origem!.nome, classe: null });
      }
    }
  }
  return lista;
}

/** Quantos usos a habilidade tem, com a tabela e o nível da classe de onde ela vem. */
export function usosDaHabilidade(
  calculo: Calculo,
  habilidade: HabilidadeNaFicha,
): ResultadoFormula<{ readonly valor: number }> | null {
  const usos = habilidade.entrada.dados.usos;
  if (!usos) {
    return null;
  }
  const classe = habilidade.classe;
  return calculo.formula(
    usos.maximo,
    classe
      ? {
          nivelClasse: classe.nivel,
          coluna: (id) => classe.entrada.dados.tabela.find((c) => c.id === id)?.valores[classe.nivel - 1],
        }
      : undefined,
  );
}

export function modificadoresDaFicha(calculo: Calculo): Record<Atributo, ReturnType<Calculo['modificador']>> {
  return Object.fromEntries(ATRIBUTOS.map((a) => [a, calculo.modificador(a)])) as Record<
    Atributo,
    ReturnType<Calculo['modificador']>
  >;
}
