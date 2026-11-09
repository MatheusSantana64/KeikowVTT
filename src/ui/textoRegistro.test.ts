import { describe, expect, it } from 'vitest';
import type { Participante } from '../core/campanha';
import type { EntradaRegistro, TipoEvento } from '../core/registro';
import { nomeDoAutor, textoDaEntrada } from './textoRegistro';

const participantes: Participante[] = [
  { id: 'mestre', nome: 'Caio', papel: 'mestre' },
  { id: 'j1', nome: '   ', papel: 'jogador' },
];

const entrada = (extra: Partial<EntradaRegistro> = {}): EntradaRegistro => ({
  id: 1,
  momento: 0,
  autorId: 'mestre',
  tipo: 'ColocarTile',
  coord: { q: 2, r: -1 },
  quantidade: 1,
  visibilidade: { tipo: 'mestre' },
  ...extra,
});

describe('textoDaEntrada', () => {
  it('uma ação mostra autor, descrição e local', () => {
    expect(textoDaEntrada(entrada(), participantes)).toBe('Caio pintou um hex (q 2, r -1)');
  });

  it('várias ações juntas mostram a quantidade, sem local', () => {
    expect(textoDaEntrada(entrada({ quantidade: 12 }), participantes)).toBe('Caio pintou 12 hexes');
  });

  it('ações sem hex não mostram local', () => {
    expect(textoDaEntrada(entrada({ tipo: 'Desfazer', coord: null }), participantes)).toBe(
      'Caio desfez uma edição do mapa',
    );
  });

  it('não quebra com um tipo de ação desconhecido', () => {
    const estranha = entrada({ tipo: 'AcaoDoFuturo' as TipoEvento, coord: null });
    expect(textoDaEntrada(estranha, participantes)).toBe('Caio fez uma ação');
  });
});

describe('nomeDoAutor', () => {
  it('usa o nome atual do participante', () => {
    expect(nomeDoAutor('mestre', participantes)).toBe('Caio');
  });

  it('avisa quando o nome está em branco', () => {
    expect(nomeDoAutor('j1', participantes)).toBe('Sem nome');
  });

  it('avisa quando o participante foi removido', () => {
    expect(nomeDoAutor('sumiu', participantes)).toBe('Participante removido');
  });
});
