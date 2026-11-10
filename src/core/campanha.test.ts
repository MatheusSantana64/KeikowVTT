import { describe, expect, it, vi } from 'vitest';
import {
  aplicarAcaoCampanha,
  criarCampanhaInicial,
  criarLojaCampanha,
  ID_MESTRE,
  type EstadoCampanha,
} from './campanha';

const comJogador = (): EstadoCampanha =>
  aplicarAcaoCampanha(criarCampanhaInicial(), {
    tipo: 'AdicionarParticipante',
    id: 'j1',
    nome: 'Ana',
  });

describe('campanha', () => {
  it('nasce só com o mestre', () => {
    expect(criarCampanhaInicial().participantes).toEqual([
      { id: ID_MESTRE, nome: 'Mestre', papel: 'mestre' },
    ]);
  });

  it('adiciona um jogador com papel de jogador', () => {
    expect(comJogador().participantes[1]).toEqual({ id: 'j1', nome: 'Ana', papel: 'jogador' });
  });

  it('não duplica o mesmo id', () => {
    const estado = comJogador();
    expect(
      aplicarAcaoCampanha(estado, { tipo: 'AdicionarParticipante', id: 'j1', nome: 'Outra' }),
    ).toBe(estado);
  });

  it('renomeia a campanha e um participante', () => {
    let estado = aplicarAcaoCampanha(comJogador(), { tipo: 'RenomearCampanha', nome: 'Sombras' });
    estado = aplicarAcaoCampanha(estado, {
      tipo: 'RenomearParticipante',
      participanteId: 'j1',
      nome: 'Bia',
    });
    expect(estado.nome).toBe('Sombras');
    expect(estado.participantes[1].nome).toBe('Bia');
  });

  it('o mestre também pode trocar de nome', () => {
    const estado = aplicarAcaoCampanha(criarCampanhaInicial(), {
      tipo: 'RenomearParticipante',
      participanteId: ID_MESTRE,
      nome: 'Narrador',
    });
    expect(estado.participantes[0]).toMatchObject({ nome: 'Narrador', papel: 'mestre' });
  });

  it('o mesmo nome e um participante inexistente não mudam nada', () => {
    const estado = comJogador();
    expect(aplicarAcaoCampanha(estado, { tipo: 'RenomearCampanha', nome: estado.nome })).toBe(estado);
    expect(
      aplicarAcaoCampanha(estado, { tipo: 'RenomearParticipante', participanteId: 'x', nome: 'y' }),
    ).toBe(estado);
  });

  it('remove um jogador', () => {
    const estado = aplicarAcaoCampanha(comJogador(), {
      tipo: 'RemoverParticipante',
      participanteId: 'j1',
    });
    expect(estado.participantes).toHaveLength(1);
  });

  it('nunca remove o mestre', () => {
    const estado = comJogador();
    expect(
      aplicarAcaoCampanha(estado, { tipo: 'RemoverParticipante', participanteId: ID_MESTRE }),
    ).toBe(estado);
  });
});

describe('criarLojaCampanha', () => {
  it('registra quem fez a ação', () => {
    const aoExecutar = vi.fn();
    const loja = criarLojaCampanha(undefined, { obterAutorId: () => ID_MESTRE, aoExecutar });
    loja.despachar({ tipo: 'RenomearCampanha', nome: 'Nova' }, 'g1');
    expect(aoExecutar).toHaveBeenCalledExactlyOnceWith({
      tipo: 'RenomearCampanha',
      coord: null,
      autorId: ID_MESTRE,
      agrupamento: 'g1',
    });
  });

  it('um jogador não muda a campanha: nada muda nem é registrado', () => {
    const aoExecutar = vi.fn();
    const aoRecusar = vi.fn();
    const loja = criarLojaCampanha(undefined, { obterAutorId: () => 'j9', aoExecutar, aoRecusar });
    loja.despachar({ tipo: 'RenomearCampanha', nome: 'Nova' });
    expect(loja.obterEstado().nome).toBe('Minha campanha');
    expect(aoExecutar).not.toHaveBeenCalled();
    expect(aoRecusar).toHaveBeenCalledWith('Só o mestre muda a campanha.');
  });

  it('uma ação sem efeito não avisa nem registra', () => {
    const aoExecutar = vi.fn();
    const ouvinte = vi.fn();
    const loja = criarLojaCampanha(undefined, { aoExecutar });
    loja.assinar(ouvinte);
    loja.despachar({ tipo: 'RemoverParticipante', participanteId: ID_MESTRE });
    expect(aoExecutar).not.toHaveBeenCalled();
    expect(ouvinte).not.toHaveBeenCalled();
  });
});
