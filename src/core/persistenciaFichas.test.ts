import { describe, expect, it } from 'vitest';
import { criarCampanhaInicial } from './campanha';
import { aplicarAcaoCompendio, criarCompendioVazio } from './compendio';
import { criarEntrada, type EntradaDe } from './entradas';
import { comClasse, comNivel, criarFicha, fichaDeMonstro, type EstadoFichas, type Ficha } from './fichas';
import { GRUPO_SEM_POSICAO } from './grupo';
import { criarMapaVazio } from './mapa';
import { serializarArquivoCompleto } from './persistenciaCampanha';
import { desserializarFichas, fichasParaObjeto, lerFichasDoArquivo, serializarFichas } from './persistenciaFichas';

const classe: EntradaDe<'classe'> = { ...criarEntrada('classe', 'guerreiro'), nome: 'Fighter' };
const compendio = aplicarAcaoCompendio(criarCompendioVazio(), { tipo: 'AdicionarEntrada', entrada: classe });

function exemplo(): EstadoFichas {
  const heroi: Ficha = {
    ...comNivel(comClasse({ ...criarFicha('personagem', 'h1', 'jogador-1'), nome: 'Ana' }, compendio, 'guerreiro'), 'guerreiro', 3),
    proficiencias: { atletismo: 1, furtividade: 2, historia: 0.5 },
    pvPorNivel: [null, 8],
    pvAtuais: 12,
    pvTemporarios: 3,
    notas: 'Tem medo de aranhas.',
  };
  const goblin = fichaDeMonstro({ ...criarEntrada('monstro', 'goblin'), nome: 'Goblin' }, 'm1');
  return { fichas: { h1: heroi, m1: goblin } };
}

const comoTexto = (valor: unknown) => JSON.stringify(valor);

describe('salvar e ler fichas', () => {
  it('lê de volta o que foi gravado', () => {
    const estado = exemplo();
    expect(desserializarFichas(serializarFichas(estado))).toEqual({ ok: true, estado });
  });

  it('o arquivo do botão Salvar traz as fichas; arquivos antigos não têm', () => {
    const estado = exemplo();
    const conteudo = { campanha: criarCampanhaInicial(), registro: [] };
    const comFichas = serializarArquivoCompleto(criarMapaVazio(), GRUPO_SEM_POSICAO, conteudo, undefined, estado);
    expect(lerFichasDoArquivo(comFichas)).toEqual({ ok: true, estado });
    const semFichas = serializarArquivoCompleto(criarMapaVazio(), GRUPO_SEM_POSICAO, conteudo);
    expect(lerFichasDoArquivo(semFichas)).toEqual({ ok: true, estado: null });
  });

  it('converte cópias de entradas de versões antigas do compêndio', () => {
    const objeto = fichasParaObjeto(exemplo());
    const antiga = {
      ...objeto,
      versaoEntradas: 2,
      fichas: objeto.fichas.map((f) => ({
        ...f,
        // Na versão 2, as classes ainda não tinham a tabela.
        entradas: f.entradas.map((e) => (e.tipo === 'classe' ? { ...e, dados: { ...e.dados, tabela: undefined } } : e)),
      })),
    };
    const lido = desserializarFichas(comoTexto(antiga));
    expect(lido.ok && lido.estado.fichas.h1.entradas.guerreiro).toEqual(classe);
  });

  it.each([
    ['classe que não está entre as cópias', (f: Record<string, unknown>) => ({ ...f, classes: [{ entradaId: 'mago', nivel: 1 }] }), 'não está entre as cópias'],
    ['nível acima de 20', (f: Record<string, unknown>) => ({ ...f, classes: [{ entradaId: 'guerreiro', nivel: 21 }] }), 'número inválido'],
    ['atributo fora do limite', (f: Record<string, unknown>) => ({ ...f, atributos: { ...(f.atributos as object), for: 31 } }), 'FOR'],
    ['proficiência estranha', (f: Record<string, unknown>) => ({ ...f, proficiencias: { atletismo: 3 } }), 'proficiência'],
    ['tipo desconhecido', (f: Record<string, unknown>) => ({ ...f, tipo: 'dragao' }), 'tipo é desconhecido'],
  ])('recusa %s', (_nome, estragar, trecho) => {
    const objeto = fichasParaObjeto(exemplo());
    const estragado = { ...objeto, fichas: [estragar(objeto.fichas[0] as unknown as Record<string, unknown>)] };
    const lido = desserializarFichas(comoTexto(estragado));
    expect(lido).toMatchObject({ ok: false, erro: expect.stringContaining(trecho) });
  });

  it('recusa versão desconhecida e texto que não é JSON', () => {
    expect(desserializarFichas(comoTexto({ ...fichasParaObjeto(exemplo()), versao: 9 })).ok).toBe(false);
    expect(desserializarFichas('lixo').ok).toBe(false);
  });
});
