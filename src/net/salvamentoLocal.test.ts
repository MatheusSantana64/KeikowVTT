import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarLojaGrupo } from '../core/grupo';
import { criarLojaMapa } from '../core/loja';
import { hexEm, type AcaoMapa } from '../core/mapa';
import { lerSalvamentoLocal, manterSalvamentoLocal } from './salvamentoLocal';

const A = { q: 0, r: 0 };
const B = { q: 1, r: 0 };
const colocar: AcaoMapa = { tipo: 'ColocarTile', coord: A, terreno: 't' };
const colocarEmB: AcaoMapa = { tipo: 'ColocarTile', coord: B, terreno: 't' };

function armazenamentoFalso() {
  const dados = new Map<string, string>();
  return {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: vi.fn((chave: string, valor: string) => {
      dados.set(chave, valor);
    }),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('salvamento automático', () => {
  it('sem nada salvo, a leitura devolve null', () => {
    expect(lerSalvamentoLocal(armazenamentoFalso())).toBeNull();
  });

  it('salva pouco depois da mudança, e o mapa pode ser lido de volta', () => {
    const armazenamento = armazenamentoFalso();
    const loja = criarLojaMapa();
    manterSalvamentoLocal(loja, criarLojaGrupo(),vi.fn(), armazenamento);
    loja.despachar(colocar);
    expect(armazenamento.setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    const lido = lerSalvamentoLocal(armazenamento);
    expect(lido?.ok && hexEm(lido.estado, A)).toBeTruthy();
  });

  it('mover o grupo também é salvo, e pode ser lido de volta', () => {
    const armazenamento = armazenamentoFalso();
    const lojaGrupo = criarLojaGrupo();
    manterSalvamentoLocal(criarLojaMapa(), lojaGrupo, vi.fn(), armazenamento);
    lojaGrupo.despachar({ tipo: 'PosicionarGrupo', coord: B });
    vi.advanceTimersByTime(600);
    expect(lerSalvamentoLocal(armazenamento)).toMatchObject({ ok: true, grupo: { posicao: B } });
  });

  it('várias mudanças seguidas geram uma única gravação', () => {
    const armazenamento = armazenamentoFalso();
    const loja = criarLojaMapa();
    manterSalvamentoLocal(loja, criarLojaGrupo(),vi.fn(), armazenamento);
    loja.despachar(colocar);
    vi.advanceTimersByTime(200);
    loja.despachar(colocarEmB);
    vi.advanceTimersByTime(600);
    expect(armazenamento.setItem).toHaveBeenCalledTimes(1);
  });

  it('não grava nada sem mudanças', () => {
    const armazenamento = armazenamentoFalso();
    manterSalvamentoLocal(criarLojaMapa(), criarLojaGrupo(), vi.fn(), armazenamento);
    vi.advanceTimersByTime(5000);
    expect(armazenamento.setItem).not.toHaveBeenCalled();
  });

  it('ao encerrar, grava o que estava pendente e para de salvar', () => {
    const armazenamento = armazenamentoFalso();
    const loja = criarLojaMapa();
    const encerrar = manterSalvamentoLocal(loja, criarLojaGrupo(),vi.fn(), armazenamento);
    loja.despachar(colocar);
    encerrar();
    expect(armazenamento.setItem).toHaveBeenCalledTimes(1);
    loja.despachar(colocarEmB);
    vi.advanceTimersByTime(600);
    expect(armazenamento.setItem).toHaveBeenCalledTimes(1);
  });

  it('avisa quando o navegador recusa guardar', () => {
    const armazenamento = armazenamentoFalso();
    armazenamento.setItem.mockImplementation(() => {
      throw new Error('cheio');
    });
    const aoFalhar = vi.fn();
    const loja = criarLojaMapa();
    manterSalvamentoLocal(loja, criarLojaGrupo(),aoFalhar, armazenamento);
    loja.despachar(colocar);
    vi.advanceTimersByTime(600);
    expect(aoFalhar).toHaveBeenCalledOnce();
  });

  it('um salvamento corrompido devolve o motivo em vez de quebrar', () => {
    const armazenamento = { getItem: () => 'lixo', setItem: vi.fn() };
    expect(lerSalvamentoLocal(armazenamento)).toMatchObject({ ok: false });
  });
});
