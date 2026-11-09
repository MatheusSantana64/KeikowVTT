import { useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import type { LojaCampanha } from '../core/campanha';
import type { LojaRegistro } from '../core/registro';
import { textoDaEntrada } from './textoRegistro';

type Aba = 'jogadores' | 'registro';

interface TelaCampanhaProps {
  readonly lojaCampanha: LojaCampanha;
  readonly lojaRegistro: LojaRegistro;
  readonly aoFechar: () => void;
}

function horario(momento: number): string {
  return new Date(momento).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TelaCampanha({ lojaCampanha, lojaRegistro, aoFechar }: TelaCampanhaProps) {
  const campanha = useSyncExternalStore(lojaCampanha.assinar, lojaCampanha.obterEstado);
  const entradas = useSyncExternalStore(lojaRegistro.assinar, lojaRegistro.obterEntradas);
  const [aba, setAba] = useState<Aba>('jogadores');
  const [nomeNovo, setNomeNovo] = useState('');
  // Cada vez que um campo recebe o foco começa uma nova linha no registro.
  const sessaoDeFoco = useRef(0);

  const adicionar = (evento: FormEvent) => {
    evento.preventDefault();
    const nome = nomeNovo.trim();
    if (nome) {
      lojaCampanha.despachar({ tipo: 'AdicionarParticipante', id: crypto.randomUUID(), nome });
      setNomeNovo('');
    }
  };

  return (
    <div className="tela-sobreposta" role="dialog" aria-label="Campanha">
      <header className="tela-cabecalho">
        <h1>Campanha</h1>
        <div className="paleta-abas" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'jogadores'}
            onClick={() => setAba('jogadores')}
          >
            Jogadores
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'registro'}
            onClick={() => setAba('registro')}
          >
            Registro
          </button>
        </div>
        <button type="button" className="tela-fechar" onClick={aoFechar}>
          Voltar ao mapa
        </button>
      </header>

      <div
        className="tela-conteudo"
        onFocus={() => {
          sessaoDeFoco.current += 1;
        }}
      >
        {aba === 'jogadores' && (
          <>
            <label className="tela-campo">
              Nome da campanha
              <input
                type="text"
                value={campanha.nome}
                onChange={(evento) =>
                  lojaCampanha.despachar(
                    { tipo: 'RenomearCampanha', nome: evento.target.value },
                    `campanha:${sessaoDeFoco.current}`,
                  )
                }
              />
            </label>

            <h2>Participantes</h2>
            <p className="tela-dica">
              Por enquanto, os jogadores são simulados: servem para testar permissões sem internet.
            </p>
            <ul className="tela-lista">
              {campanha.participantes.map((participante) => (
                <li key={participante.id}>
                  <input
                    type="text"
                    aria-label="Nome do participante"
                    value={participante.nome}
                    onChange={(evento) =>
                      lojaCampanha.despachar(
                        {
                          tipo: 'RenomearParticipante',
                          participanteId: participante.id,
                          nome: evento.target.value,
                        },
                        `participante:${participante.id}:${sessaoDeFoco.current}`,
                      )
                    }
                  />
                  <span className="tela-papel">
                    {participante.papel === 'mestre' ? 'Mestre' : 'Jogador'}
                  </span>
                  {participante.papel === 'jogador' && (
                    <button
                      type="button"
                      onClick={() =>
                        lojaCampanha.despachar({
                          tipo: 'RemoverParticipante',
                          participanteId: participante.id,
                        })
                      }
                    >
                      Remover
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <form className="tela-adicionar" onSubmit={adicionar}>
              <input
                type="text"
                aria-label="Nome do novo jogador"
                placeholder="Nome do novo jogador"
                value={nomeNovo}
                onChange={(evento) => setNomeNovo(evento.target.value)}
              />
              <button type="submit" disabled={!nomeNovo.trim()}>
                Adicionar
              </button>
            </form>
          </>
        )}

        {aba === 'registro' && (
          <>
            <p className="tela-dica">Só o mestre vê este registro. As últimas 500 linhas ficam guardadas.</p>
            {entradas.length === 0 && <p className="tela-dica">Nada foi registrado ainda.</p>}
            <ol className="tela-registro">
              {[...entradas].reverse().map((entrada) => (
                <li key={entrada.id}>
                  <time>{horario(entrada.momento)}</time>
                  <span>{textoDaEntrada(entrada, campanha.participantes)}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
