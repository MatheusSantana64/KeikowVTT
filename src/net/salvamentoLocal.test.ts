import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarLojaGrupo, GRUPO_SEM_POSICAO } from '../core/grupo';
import { criarLojaMapa } from '../core/loja';
import { criarMapaVazio, hexEm, aplicarAcao, type AcaoMapa } from '../core/mapa';
import { serializarMapa } from '../core/persistencia';
import { criarLojaCampanha } from '../core/campanha';
import { criarLojaRegistro } from '../core/registro';
import { criarLojaCompendio } from '../core/compendio';
import { criarEntrada } from '../core/entradas';
import {
  lerCampanhaLocal,
  lerCompendioLocal,
  lerSalvamentoLocal,
  manterCampanhaLocal,
  manterCompendioLocal,
  manterSalvamentoLocal,
} from './salvamentoLocal';

const A = { q: 0, r: 0 };
const B = { q: 1, r: 0 };
const colocar: AcaoMapa = { tipo: 'ColocarTile', coord: A, terreno: 't' };
const colocarEmB: AcaoMapa = { tipo: 'ColocarTile', coord: B, terreno: 't' };

const CHAVE = 'keikow.mapa';
const CHAVE_EMERGENCIA = 'keikow.mapa.emergencia';

function armazenamentoPrincipal() {
  const dados = new Map<string, string>();
  return {
    dados,
    obter: vi.fn(async (chave: string) => dados.get(chave) ?? null),
    gravar: vi.fn(async (chave: string, valor: string) => {
      dados.set(chave, valor);
    }),
  };
}

function armazenamentoRapido() {
  const dados = new Map<string, string>();
  return {
    dados,
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: vi.fn((chave: string, valor: string) => {
      dados.set(chave, valor);
    }),
    removeItem: (chave: string) => {
      dados.delete(chave);
    },
  };
}

function montar() {
  const principal = armazenamentoPrincipal();
  const rapido = armazenamentoRapido();
  const loja = criarLojaMapa();
  const lojaGrupo = criarLojaGrupo();
  const aoFalhar = vi.fn();
  const iniciar = () => manterSalvamentoLocal(loja, lojaGrupo, aoFalhar, principal, rapido);
  return { principal, rapido, loja, lojaGrupo, aoFalhar, iniciar };
}

const mapaValido = () =>
  serializarMapa(aplicarAcao(criarMapaVazio(), colocar), GRUPO_SEM_POSICAO);

const esperarSalvamento = () => vi.advanceTimersByTimeAsync(600);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('salvamento automático', () => {
  it('sem nada salvo, a leitura devolve null', async () => {
    const { principal, rapido } = montar();
    expect(await lerSalvamentoLocal(principal, rapido)).toBeNull();
  });

  it('salva pouco depois da mudança, e o mapa pode ser lido de volta', async () => {
    const { principal, rapido, loja, iniciar } = montar();
    iniciar();
    loja.despachar(colocar);
    expect(principal.gravar).not.toHaveBeenCalled();
    await esperarSalvamento();
    const lido = await lerSalvamentoLocal(principal, rapido);
    expect(lido?.ok && hexEm(lido.estado, A)).toBeTruthy();
  });

  it('mover o grupo também é salvo, e pode ser lido de volta', async () => {
    const { principal, rapido, lojaGrupo, iniciar } = montar();
    iniciar();
    lojaGrupo.despachar({ tipo: 'PosicionarGrupo', coord: B });
    await esperarSalvamento();
    expect(await lerSalvamentoLocal(principal, rapido)).toMatchObject({
      ok: true,
      grupo: { posicao: B },
    });
  });

  it('várias mudanças seguidas geram uma única gravação', async () => {
    const { principal, loja, iniciar } = montar();
    iniciar();
    loja.despachar(colocar);
    await vi.advanceTimersByTimeAsync(200);
    loja.despachar(colocarEmB);
    await esperarSalvamento();
    expect(principal.gravar).toHaveBeenCalledTimes(1);
  });

  it('não grava nada sem mudanças', async () => {
    const { principal, iniciar } = montar();
    iniciar();
    await vi.advanceTimersByTimeAsync(5000);
    expect(principal.gravar).not.toHaveBeenCalled();
  });

  it('uma mudança feita durante a gravação não se perde', async () => {
    const { principal, rapido, loja, iniciar } = montar();
    let liberar = () => {};
    principal.gravar.mockImplementationOnce(async (chave, valor) => {
      await new Promise<void>((resolver) => {
        liberar = resolver;
      });
      principal.dados.set(chave, valor);
    });
    iniciar();
    loja.despachar(colocar);
    await esperarSalvamento();
    loja.despachar(colocarEmB);
    liberar();
    await esperarSalvamento();
    const lido = await lerSalvamentoLocal(principal, rapido);
    expect(lido?.ok && hexEm(lido.estado, B)).toBeTruthy();
  });

  it('ao encerrar, grava o que estava pendente e para de salvar', async () => {
    const { principal, loja, iniciar } = montar();
    const encerrar = iniciar();
    loja.despachar(colocar);
    encerrar();
    await vi.advanceTimersByTimeAsync(0);
    expect(principal.gravar).toHaveBeenCalledTimes(1);
    loja.despachar(colocarEmB);
    await esperarSalvamento();
    expect(principal.gravar).toHaveBeenCalledTimes(1);
  });

  it('avisa quando o navegador recusa guardar, e tenta de novo na próxima mudança', async () => {
    const { principal, loja, aoFalhar, iniciar } = montar();
    principal.gravar.mockRejectedValueOnce(new Error('cheio'));
    iniciar();
    loja.despachar(colocar);
    await esperarSalvamento();
    expect(aoFalhar).toHaveBeenCalledOnce();
    loja.despachar(colocarEmB);
    await esperarSalvamento();
    expect(principal.gravar).toHaveBeenCalledTimes(2);
    expect(aoFalhar).toHaveBeenCalledOnce();
  });

  it('um salvamento corrompido devolve o motivo em vez de quebrar', async () => {
    const { principal, rapido } = montar();
    principal.dados.set(CHAVE, 'lixo');
    expect(await lerSalvamentoLocal(principal, rapido)).toMatchObject({ ok: false });
  });

  it('avisa se o navegador não permitir ler, quando não há outra cópia', async () => {
    const { principal, rapido } = montar();
    principal.obter.mockRejectedValueOnce(new Error('bloqueado'));
    expect(await lerSalvamentoLocal(principal, rapido)).toMatchObject({ ok: false });
  });
});

describe('migração do armazenamento antigo', () => {
  it('traz o mapa antigo, confere e só então apaga a cópia', async () => {
    const { principal, rapido } = montar();
    rapido.dados.set(CHAVE, mapaValido());
    const lido = await lerSalvamentoLocal(principal, rapido);
    expect(lido?.ok && hexEm(lido.estado, A)).toBeTruthy();
    expect(principal.dados.get(CHAVE)).toBe(mapaValido());
    expect(rapido.dados.has(CHAVE)).toBe(false);
  });

  it('se a gravação falhar, mostra o mapa e mantém a cópia antiga', async () => {
    const { principal, rapido } = montar();
    rapido.dados.set(CHAVE, mapaValido());
    principal.gravar.mockRejectedValueOnce(new Error('cheio'));
    const lido = await lerSalvamentoLocal(principal, rapido);
    expect(lido?.ok).toBe(true);
    expect(rapido.dados.has(CHAVE)).toBe(true);
  });

  it('se a conferência não bater, mantém a cópia antiga', async () => {
    const { principal, rapido } = montar();
    rapido.dados.set(CHAVE, mapaValido());
    principal.obter.mockResolvedValueOnce(null).mockResolvedValueOnce('outro texto');
    await lerSalvamentoLocal(principal, rapido);
    expect(rapido.dados.has(CHAVE)).toBe(true);
  });

  it('um mapa antigo corrompido não é copiado nem apagado', async () => {
    const { principal, rapido } = montar();
    rapido.dados.set(CHAVE, 'lixo');
    expect(await lerSalvamentoLocal(principal, rapido)).toMatchObject({ ok: false });
    expect(principal.gravar).not.toHaveBeenCalled();
    expect(rapido.dados.has(CHAVE)).toBe(true);
  });

  it('se o armazenamento novo estiver indisponível, ainda abre o mapa antigo', async () => {
    const { principal, rapido } = montar();
    rapido.dados.set(CHAVE, mapaValido());
    principal.obter.mockRejectedValue(new Error('bloqueado'));
    expect((await lerSalvamentoLocal(principal, rapido))?.ok).toBe(true);
  });

  it('com mapa no armazenamento novo, a cópia antiga é ignorada', async () => {
    const { principal, rapido } = montar();
    principal.dados.set(CHAVE, serializarMapa(criarMapaVazio(), GRUPO_SEM_POSICAO));
    rapido.dados.set(CHAVE, mapaValido());
    const lido = await lerSalvamentoLocal(principal, rapido);
    expect(lido?.ok && hexEm(lido.estado, A)).toBeFalsy();
  });
});

describe('salvamento da campanha', () => {
  function montarCampanha() {
    const principal = armazenamentoPrincipal();
    const rapido = armazenamentoRapido();
    const lojaRegistro = criarLojaRegistro();
    const lojaCampanha = criarLojaCampanha(undefined, { aoExecutar: lojaRegistro.registrar });
    const aoFalhar = vi.fn();
    const iniciar = () =>
      manterCampanhaLocal(lojaCampanha, lojaRegistro, aoFalhar, principal, rapido);
    return { principal, rapido, lojaRegistro, lojaCampanha, aoFalhar, iniciar };
  }

  it('sem nada salvo, a leitura devolve null', async () => {
    const { principal, rapido } = montarCampanha();
    expect(await lerCampanhaLocal(principal, rapido)).toBeNull();
  });

  it('participantes e registro podem ser lidos de volta', async () => {
    const { principal, rapido, lojaCampanha, iniciar } = montarCampanha();
    iniciar();
    lojaCampanha.despachar({ tipo: 'AdicionarParticipante', id: 'j1', nome: 'Ana' });
    await esperarSalvamento();
    const lida = await lerCampanhaLocal(principal, rapido);
    expect(lida).toMatchObject({
      ok: true,
      campanha: { participantes: [{ id: 'mestre' }, { id: 'j1', nome: 'Ana' }] },
      registro: [{ tipo: 'AdicionarParticipante' }],
    });
  });

  it('uma nova linha no registro também é salva', async () => {
    const { principal, lojaRegistro, iniciar } = montarCampanha();
    iniciar();
    lojaRegistro.registrar({ tipo: 'RevelarHex', coord: A, autorId: 'mestre', agrupamento: null });
    await esperarSalvamento();
    expect(principal.dados.get('keikow.campanha')).toContain('RevelarHex');
  });

  it('não interfere no mapa guardado', async () => {
    const { principal, rapido, lojaCampanha, iniciar } = montarCampanha();
    principal.dados.set(CHAVE, mapaValido());
    iniciar();
    lojaCampanha.despachar({ tipo: 'RenomearCampanha', nome: 'Outra' });
    await esperarSalvamento();
    expect(principal.dados.get(CHAVE)).toBe(mapaValido());
    const lido = await lerSalvamentoLocal(principal, rapido);
    expect(lido?.ok && hexEm(lido.estado, A)).toBeTruthy();
  });

  it('um salvamento corrompido devolve o motivo', async () => {
    const { principal, rapido } = montarCampanha();
    principal.dados.set('keikow.campanha', 'lixo');
    expect(await lerCampanhaLocal(principal, rapido)).toMatchObject({ ok: false });
  });

  it('usa uma cópia às pressas própria, sem misturar com a do mapa', async () => {
    const janela = new EventTarget();
    vi.stubGlobal('window', janela);
    const { principal, rapido, lojaCampanha, iniciar } = montarCampanha();
    principal.gravar.mockImplementationOnce(() => new Promise<void>(() => {}));
    iniciar();
    lojaCampanha.despachar({ tipo: 'RenomearCampanha', nome: 'Às pressas' });
    janela.dispatchEvent(new Event('pagehide'));
    expect(rapido.dados.has('keikow.campanha.emergencia')).toBe(true);
    expect(rapido.dados.has(CHAVE_EMERGENCIA)).toBe(false);
    expect(await lerCampanhaLocal(armazenamentoPrincipal(), rapido)).toMatchObject({
      ok: true,
      campanha: { nome: 'Às pressas' },
    });
  });
});

describe('salvamento do compêndio', () => {
  it('as entradas podem ser lidas de volta, sem mexer no mapa', async () => {
    const principal = armazenamentoPrincipal();
    const rapido = armazenamentoRapido();
    principal.dados.set(CHAVE, mapaValido());
    const lojaCompendio = criarLojaCompendio();
    manterCompendioLocal(lojaCompendio, vi.fn(), principal, rapido);
    lojaCompendio.despachar({
      tipo: 'AdicionarEntrada',
      entrada: { ...criarEntrada('item', 'espada'), nome: 'Espada' },
    });
    await esperarSalvamento();
    const lido = await lerCompendioLocal(principal, rapido);
    expect(lido?.ok && lido.estado.entradas.espada?.nome).toBe('Espada');
    expect(principal.dados.get(CHAVE)).toBe(mapaValido());
  });

  it('sem nada salvo, a leitura devolve null', async () => {
    expect(await lerCompendioLocal(armazenamentoPrincipal(), armazenamentoRapido())).toBeNull();
  });
});

describe('fechar a página antes de terminar de gravar', () => {
  function comJanela() {
    const janela = new EventTarget();
    vi.stubGlobal('window', janela);
    return () => janela.dispatchEvent(new Event('pagehide'));
  }

  it('guarda uma cópia às pressas, usada na próxima abertura', async () => {
    const fecharPagina = comJanela();
    const { principal, rapido, loja, iniciar } = montar();
    principal.gravar.mockImplementationOnce(() => new Promise<void>(() => {}));
    iniciar();
    loja.despachar(colocar);
    fecharPagina();
    expect(rapido.dados.has(CHAVE_EMERGENCIA)).toBe(true);

    const reaberto = armazenamentoPrincipal();
    const lido = await lerSalvamentoLocal(reaberto, rapido);
    expect(lido?.ok && hexEm(lido.estado, A)).toBeTruthy();
    expect(reaberto.dados.has(CHAVE)).toBe(true);
    expect(rapido.dados.has(CHAVE_EMERGENCIA)).toBe(false);
  });

  it('sem mudanças pendentes, não cria cópia', () => {
    const fecharPagina = comJanela();
    const { rapido, iniciar } = montar();
    iniciar();
    fecharPagina();
    expect(rapido.dados.has(CHAVE_EMERGENCIA)).toBe(false);
  });

  it('se a gravação terminar depois, a cópia às pressas é apagada', async () => {
    const fecharPagina = comJanela();
    const { rapido, loja, iniciar } = montar();
    iniciar();
    loja.despachar(colocar);
    fecharPagina();
    await vi.advanceTimersByTimeAsync(0);
    expect(rapido.dados.has(CHAVE_EMERGENCIA)).toBe(false);
  });

  it('uma cópia às pressas inválida é descartada e o mapa salvo é usado', async () => {
    const { principal, rapido } = montar();
    principal.dados.set(CHAVE, mapaValido());
    rapido.dados.set(CHAVE_EMERGENCIA, 'lixo');
    const lido = await lerSalvamentoLocal(principal, rapido);
    expect(lido?.ok && hexEm(lido.estado, A)).toBeTruthy();
    expect(rapido.dados.has(CHAVE_EMERGENCIA)).toBe(false);
  });
});
