import { useSyncExternalStore } from 'react';
import type { LojaRolagens, RolagemRegistrada } from '../core/rolagens';
import { numeroNaTela } from './numeros';

function hora(momento: number): string {
  return new Date(momento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Os dados como foram rolados: "[17, 4]", com os que não contaram riscados. */
function DadosRolados({ rolagem }: { readonly rolagem: RolagemRegistrada }) {
  return (
    <span className="rolagem-dados">
      {rolagem.dados.map((d, i) => (
        <span key={i} title={d.texto}>
          {d.texto}[
          {d.valores.map((v, j) => (
            <span
              key={j}
              className={[
                d.mantidos[j] ? '' : 'rolagem-descartado',
                d.faces === 20 && d.mantidos[j] && v === 20 ? 'rolagem-vinte' : '',
                d.faces === 20 && d.mantidos[j] && v === 1 ? 'rolagem-um' : '',
              ].join(' ')}
            >
              {j > 0 ? ', ' : ''}
              {v}
            </span>
          ))}
          ]{' '}
        </span>
      ))}
    </span>
  );
}

/** O registro de rolagens da mesa. Na fase online, vira o chat. */
export function PainelRolagens({
  lojaRolagens,
  secreta,
  aoMudarSecreta,
}: {
  readonly lojaRolagens: LojaRolagens;
  readonly secreta: boolean;
  readonly aoMudarSecreta: (secreta: boolean) => void;
}) {
  const rolagens = useSyncExternalStore(lojaRolagens.assinar, lojaRolagens.obterRolagens);
  return (
    <aside className="painel-rolagens" aria-label="Rolagens">
      <header>
        <h2>Rolagens</h2>
        <button type="button" disabled={rolagens.length === 0} onClick={lojaRolagens.limpar} title="Apagar o registro de rolagens">
          Limpar
        </button>
      </header>
      <label className="campo-marcar" title="Rolagens secretas só aparecem para o mestre">
        <input type="checkbox" checked={secreta} onChange={(e) => aoMudarSecreta(e.target.checked)} />
        Rolar em segredo (só o mestre vê)
      </label>
      {rolagens.length === 0 && <p className="tela-dica">Clique num teste, perícia ou ataque para rolar.</p>}
      <ol>
        {rolagens.map((r) => (
          <li key={r.id} className={r.natural === 20 ? 'rolagem-critica' : r.natural === 1 ? 'rolagem-falha' : ''}>
            <div className="rolagem-topo">
              <strong>{r.quem}</strong>
              <small>
                {r.visibilidade.tipo === 'mestre' && 'secreta · '}
                {hora(r.momento)}
              </small>
            </div>
            <div>{r.rotulo}</div>
            <div className="rolagem-conta">
              <span>{r.formula}</span>
              <span className="rolagem-total">{numeroNaTela(r.total)}</span>
            </div>
            <DadosRolados rolagem={r} />
            {r.natural === 20 && <div className="rolagem-aviso">20 natural!</div>}
            {r.natural === 1 && <div className="rolagem-aviso">1 natural</div>}
          </li>
        ))}
      </ol>
    </aside>
  );
}
