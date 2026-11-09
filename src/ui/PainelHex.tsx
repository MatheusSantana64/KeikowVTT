import { useRef, useState, useSyncExternalStore } from 'react';
import { chaveHex, type CoordHex } from '../core/hex';
import type { LojaMapa } from '../core/loja';
import { hexEm, type Nota } from '../core/mapa';
import { SO_MESTRE, VISIVEL_A_TODOS, type Visibilidade } from '../core/visibilidade';
import { nomeAmigavel } from './nomeAmigavel';

interface PainelHexProps {
  readonly loja: LojaMapa;
  readonly coord: CoordHex;
  readonly aoFechar: () => void;
}

export function PainelHex({ loja, coord, aoFechar }: PainelHexProps) {
  const estado = useSyncExternalStore(loja.assinar, loja.obterEstado);
  const hex = hexEm(estado, coord);
  // Cada vez que um campo recebe o foco começa um novo passo de desfazer.
  const sessaoDeFoco = useRef(0);
  const [notaRecemCriada, setNotaRecemCriada] = useState<string | null>(null);

  const grupoDoCampo = (campo: string) =>
    `${chaveHex(coord)}:${campo}:${sessaoDeFoco.current}`;

  const adicionarNota = (visibilidade: Visibilidade) => {
    const id = crypto.randomUUID();
    loja.despachar({ tipo: 'AdicionarNota', coord, nota: { id, texto: '', visibilidade } });
    setNotaRecemCriada(id);
  };

  const renderizarNota = (nota: Nota) => {
    const proxima = nota.visibilidade.tipo === 'todos' ? SO_MESTRE : VISIVEL_A_TODOS;
    return (
      <li key={nota.id}>
        <textarea
          aria-label="Texto da nota"
          rows={2}
          value={nota.texto}
          autoFocus={nota.id === notaRecemCriada}
          onChange={(evento) =>
            loja.despachar(
              { tipo: 'EditarNota', coord, notaId: nota.id, texto: evento.target.value },
              grupoDoCampo(nota.id),
            )
          }
        />
        <div className="painel-nota-acoes">
          <button
            type="button"
            onClick={() =>
              loja.despachar({
                tipo: 'DefinirVisibilidadeNota',
                coord,
                notaId: nota.id,
                visibilidade: proxima,
              })
            }
          >
            {proxima.tipo === 'todos' ? 'Tornar pública' : 'Tornar secreta'}
          </button>
          <button
            type="button"
            onClick={() => loja.despachar({ tipo: 'RemoverNota', coord, notaId: nota.id })}
          >
            Apagar
          </button>
        </div>
      </li>
    );
  };

  const renderizarSecao = (
    titulo: string,
    classe: string,
    visibilidade: Visibilidade,
    rotuloAdicionar: string,
  ) => (
    <section className={`painel-secao ${classe}`}>
      <h3>{titulo}</h3>
      <ul>
        {hex?.notas.filter((n) => n.visibilidade.tipo === visibilidade.tipo).map(renderizarNota)}
      </ul>
      <button type="button" className="painel-adicionar" onClick={() => adicionarNota(visibilidade)}>
        {rotuloAdicionar}
      </button>
    </section>
  );

  return (
    <aside
      className="painel-hex"
      aria-label="Informações do hex"
      onFocus={() => {
        sessaoDeFoco.current += 1;
      }}
    >
      <header>
        <div>
          <h2>{hex ? hex.nome || nomeAmigavel(hex.terreno) : 'Hex vazio'}</h2>
          <p className="painel-coordenada">
            {hex && `${nomeAmigavel(hex.terreno)} · `}q {coord.q}, r {coord.r}
          </p>
        </div>
        <button type="button" aria-label="Fechar painel" onClick={aoFechar}>
          ×
        </button>
      </header>

      {!hex && <p>Pinte um terreno neste hex para poder guardar informações nele.</p>}

      {hex && (
        <>
          <label className="painel-campo">
            Nome
            <input
              type="text"
              value={hex.nome}
              placeholder="Sem nome"
              onChange={(evento) =>
                loja.despachar(
                  { tipo: 'EditarInformacaoHex', coord, campos: { nome: evento.target.value } },
                  grupoDoCampo('nome'),
                )
              }
            />
          </label>
          <label className="painel-campo">
            Descrição
            <textarea
              rows={3}
              value={hex.descricao}
              placeholder="O que os jogadores veem aqui"
              onChange={(evento) =>
                loja.despachar(
                  {
                    tipo: 'EditarInformacaoHex',
                    coord,
                    campos: { descricao: evento.target.value },
                  },
                  grupoDoCampo('descricao'),
                )
              }
            />
          </label>
          {renderizarSecao(
            'Notas públicas',
            'painel-publicas',
            VISIVEL_A_TODOS,
            '+ Adicionar nota pública',
          )}
          {renderizarSecao(
            'Notas secretas (só o mestre)',
            'painel-secretas',
            SO_MESTRE,
            '+ Adicionar nota secreta',
          )}
        </>
      )}
    </aside>
  );
}
