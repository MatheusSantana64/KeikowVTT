import type { Participante } from '../core/campanha';
import { paraJogadores, SO_MESTRE, VISIVEL_A_TODOS, type Visibilidade } from '../core/visibilidade';

/**
 * Quem vê uma informação: todos, só o mestre, ou os jogadores escolhidos.
 * Com "jogadores escolhidos", aparece uma marca para cada jogador da campanha.
 */
export function SeletorVisibilidade({
  rotulo,
  valor,
  participantes,
  aoMudar,
  rotuloRestrito = 'Só o mestre',
  desativado = false,
  dica,
}: {
  readonly rotulo: string;
  readonly valor: Visibilidade;
  readonly participantes: readonly Participante[];
  readonly aoMudar: (visibilidade: Visibilidade) => void;
  /** Como chamar o "só o mestre" aqui: numa ficha, o dono também vê. */
  readonly rotuloRestrito?: string;
  readonly desativado?: boolean;
  readonly dica?: string;
}) {
  const jogadores = participantes.filter((p) => p.papel === 'jogador');
  const escolhidos = valor.tipo === 'jogadores' ? valor.ids : [];

  const mudarTipo = (tipo: string) => {
    if (tipo === 'todos') {
      aoMudar(VISIVEL_A_TODOS);
    } else if (tipo === 'mestre') {
      aoMudar(SO_MESTRE);
    } else {
      aoMudar(paraJogadores(escolhidos));
    }
  };

  const alternar = (id: string, marcado: boolean) =>
    aoMudar(paraJogadores(marcado ? [...escolhidos, id] : escolhidos.filter((e) => e !== id)));

  return (
    <div className="campo seletor-visibilidade" title={dica}>
      <label>
        <span>{rotulo}</span>
        <select value={valor.tipo} disabled={desativado} onChange={(e) => mudarTipo(e.target.value)}>
          <option value="mestre">{rotuloRestrito}</option>
          <option value="todos">Todos</option>
          <option value="jogadores">Jogadores escolhidos</option>
        </select>
      </label>
      {valor.tipo === 'jogadores' && (
        <div className="seletor-visibilidade-jogadores">
          {jogadores.length === 0 && <small className="tela-dica">Ainda não há jogadores na campanha.</small>}
          {jogadores.map((j) => (
            <label key={j.id} className="campo-marcar">
              <input
                type="checkbox"
                disabled={desativado}
                checked={escolhidos.includes(j.id)}
                onChange={(e) => alternar(j.id, e.target.checked)}
              />
              {j.nome || 'Sem nome'}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** Quem está usando o programa agora: o mestre ou um dos jogadores, para testar o que cada um vê e pode fazer. */
export function SeletorAgindoComo({
  participantes,
  valor,
  aoMudar,
}: {
  readonly participantes: readonly Participante[];
  readonly valor: string;
  readonly aoMudar: (participanteId: string) => void;
}) {
  return (
    <label className="agindo-como" title="Mostra só o que este participante vê, e as ações ficam registradas em nome dele">
      <span>Agindo como</span>
      <select value={valor} onChange={(e) => aoMudar(e.target.value)}>
        {participantes.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome || 'Sem nome'}
            {p.papel === 'mestre' ? ' (mestre)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
