import { useMemo, useState } from 'react';
import type { RolagemFeita } from '../core/acoesDaFicha';
import { calcularFicha } from '../core/calculoDaFicha';
import { buscarEntradas, type EstadoCompendio } from '../core/compendio';
import {
  classeDaSubida,
  fichaComNivel,
  guiaDeMagias,
  habilidadesDoNivel,
  magiasDaClasse,
  pendenciasDaSubida,
  type AumentoDeNivel,
  type EscolhasDeNivel,
} from '../core/criacaoDePersonagem';
import { ATRIBUTOS, type Atributo, type EntradaDe } from '../core/entradas';
import { nivelTotal, type Ficha } from '../core/fichas';
import { lerFormula, rolarFormula } from '../core/formulas';
import { podeVer } from '../core/visibilidade';
import { useRegras } from './contextoRegras';
import { comSinal } from './ExplicacaoValor';
import { numeroNaTela } from './numeros';
import { ROTULO_ESCOLA } from './rotulosCompendio';

type TipoAumento = 'dois' | 'um' | 'talento';

interface Props {
  readonly ficha: Ficha;
  readonly compendio: EstadoCompendio;
  readonly autorId: string;
  /** Aplica a ficha com o nível novo. */
  readonly aoConfirmar: (nova: Ficha) => void;
  /** Registra a rolagem dos PV no registro da mesa. */
  readonly registrarRolagens: (feitas: readonly RolagemFeita[]) => void;
  readonly aoFechar: () => void;
}

/**
 * A subida de nível: escolher a classe (a mesma ou outra), os PV, o aumento de atributo
 * ou talento nos níveis certos e as magias novas, vendo antes e depois.
 */
export function SubidaDeNivel({ ficha, compendio, autorId, aoConfirmar, registrarRolagens, aoFechar }: Props) {
  const regras = useRegras();
  const [classeId, setClasseId] = useState(ficha.classes[0]?.entradaId ?? '');
  const [pvRolado, setPvRolado] = useState<number | null>(null);
  const [tipoAumento, setTipoAumento] = useState<TipoAumento>('dois');
  const [atributoDois, setAtributoDois] = useState<Atributo>('for');
  const [atributosUm, setAtributosUm] = useState<[Atributo, Atributo]>(['for', 'des']);
  const [talentoId, setTalentoId] = useState('');
  const [magias, setMagias] = useState<string[]>([]);

  const visivel = (e: { visibilidade: Parameters<typeof podeVer>[0] }) => podeVer(e.visibilidade, autorId);
  const outrasClasses = (buscarEntradas(compendio, { tipos: ['classe'] }) as EntradaDe<'classe'>[]).filter(
    (c) => visivel(c) && !ficha.classes.some((fc) => fc.entradaId === c.id),
  );
  const talentos = (buscarEntradas(compendio, { tipos: ['talento'] }) as EntradaDe<'talento'>[]).filter(
    (t) => visivel(t) && !ficha.extras.includes(t.id),
  );
  const subida = classeId ? classeDaSubida(ficha, classeId, compendio) : null;
  const ganhaAumento = subida ? subida.entrada.dados.niveisDeAumento.includes(subida.novoNivel) : false;

  const aumento: AumentoDeNivel | null = !ganhaAumento
    ? null
    : tipoAumento === 'talento'
      ? { tipo: 'talento', entradaId: talentoId }
      : tipoAumento === 'dois'
        ? { tipo: 'atributos', aumentos: { [atributoDois]: 2 } }
        : { tipo: 'atributos', aumentos: { [atributosUm[0]]: 1, [atributosUm[1]]: 1 } };

  const escolhas: EscolhasDeNivel = { classeId, pvRolado, aumento, magias };
  const pendencias = subida ? pendenciasDaSubida(ficha, escolhas, compendio, regras) : ['Escolha uma classe.'];
  // Se a escolha ainda está incompleta, a prévia mostra o nível sem aumento.
  const depois = subida ? fichaComNivel(ficha, { ...escolhas, aumento: pendencias.length === 0 ? aumento : null }, compendio) : ficha;
  const antes = useMemo(() => calcularFicha(ficha, regras), [ficha, regras]);
  const calculoDepois = calcularFicha(depois, regras);

  const trocarClasse = (id: string) => {
    setClasseId(id);
    // O dado de vida e as magias mudam com a classe.
    setPvRolado(null);
    setMagias([]);
  };

  const rolarPv = () => {
    if (!subida) {
      return;
    }
    const texto = `1d${subida.entrada.dados.dadoVida}`;
    const lida = lerFormula(texto);
    if (!lida.ok) {
      return;
    }
    const rolagem = rolarFormula(lida.formula, { valor: () => undefined });
    if (rolagem.ok) {
      registrarRolagens([{ rotulo: `PV do nível ${nivelTotal(ficha) + 1}`, formula: texto, rolagem }]);
      setPvRolado(rolagem.total);
    }
  };

  const novasHabilidades = subida ? habilidadesDoNivel(subida.entrada, subida.novoNivel, compendio, ficha) : [];
  const conhecidas = new Set(ficha.extras);
  const listaDeMagias = subida?.entrada.dados.atributoConjuracao
    ? magiasDaClasse(depois, classeId, compendio, calculoDepois).filter((m) => visivel(m) && !conhecidas.has(m.id))
    : [];
  const guia = subida?.entrada.dados.atributoConjuracao ? guiaDeMagias(depois, classeId, calculoDepois) : null;
  const media = subida ? Math.floor(subida.entrada.dados.dadoVida / 2) + 1 : 0;
  const multiclasse = subida && !ficha.classes.some((c) => c.entradaId === classeId);
  const prerequisito = multiclasse ? subida?.entrada.descricao.match(/Multiclassing prerequisite:[^\n]*/)?.[0] : null;

  const comparar = (rotulo: string, a: ReturnType<typeof antes.valor>, d: ReturnType<typeof antes.valor>, sinal = false) => {
    const texto = (c: typeof a) => (c.ok ? (sinal ? comSinal(c.valor) : numeroNaTela(c.valor)) : '—');
    const mudou = texto(a) !== texto(d);
    return (
      <div key={rotulo} className={mudou ? 'subida-mudou' : undefined}>
        <dt>{rotulo}</dt>
        <dd>
          {texto(a)}
          {mudou && ` → ${texto(d)}`}
        </dd>
      </div>
    );
  };

  return (
    <div className="janela-fundo" role="dialog" aria-label="Subir de nível">
      <div className="janela janela-larga subida">
        <h3>
          Subir de nível: {ficha.nome || 'Sem nome'} (nível {nivelTotal(ficha)} → {nivelTotal(ficha) + 1})
        </h3>

        <section>
          <h4>Classe</h4>
          <div className="assistente-marcas">
            {ficha.classes.map((c) => (
              <label key={c.entradaId} className="campo-marcar">
                <input type="radio" name="classe" checked={classeId === c.entradaId} onChange={() => trocarClasse(c.entradaId)} />
                {ficha.entradas[c.entradaId]?.nome ?? '?'} {c.nivel} → {c.nivel + 1}
              </label>
            ))}
          </div>
          {outrasClasses.length > 0 && (
            <label className="campo">
              <span>Ou outra classe (multiclasse)</span>
              <select value={multiclasse ? classeId : ''} onChange={(e) => e.target.value && trocarClasse(e.target.value)}>
                <option value="">Escolha…</option>
                {outrasClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          {prerequisito && <p className="tela-dica">{prerequisito} (confira com o mestre)</p>}
        </section>

        {subida && (
          <>
            <section>
              <h4>
                O que {subida.entrada.nome} {subida.novoNivel} traz
              </h4>
              {novasHabilidades.length === 0 && <p className="tela-dica">Nenhuma habilidade nova neste nível.</p>}
              {novasHabilidades.map((h) => (
                <details key={h.id}>
                  <summary>{h.nome}</summary>
                  <p className="painel-texto">{h.descricao || 'Sem descrição.'}</p>
                </details>
              ))}
            </section>

            <section>
              <h4>Pontos de vida</h4>
              <div className="assistente-marcas">
                <label className="campo-marcar">
                  <input type="radio" name="pv" checked={pvRolado === null} disabled={pvRolado !== null} onChange={() => setPvRolado(null)} />
                  Média: {media} (d{subida.entrada.dados.dadoVida})
                </label>
                <span>
                  <button type="button" disabled={pvRolado !== null} onClick={rolarPv}>
                    {pvRolado === null ? `Rolar 1d${subida.entrada.dados.dadoVida}` : `Rolado: ${pvRolado}`}
                  </button>
                </span>
              </div>
              <p className="tela-dica">A Constituição soma por cima. A rolagem aparece no registro para todos.</p>
            </section>

            {ganhaAumento && (
              <section>
                <h4>Aumento de atributo ou talento</h4>
                <div className="assistente-marcas">
                  {(
                    [
                      ['dois', '+2 em um atributo'],
                      ['um', '+1 em dois atributos'],
                      ['talento', 'Um talento'],
                    ] as const
                  ).map(([tipo, rotulo]) => (
                    <label key={tipo} className="campo-marcar">
                      <input type="radio" name="aumento" checked={tipoAumento === tipo} onChange={() => setTipoAumento(tipo)} />
                      {rotulo}
                    </label>
                  ))}
                </div>
                {tipoAumento === 'dois' && (
                  <SeletorAtributo valor={atributoDois} aoMudar={setAtributoDois} nomes={regras.atributos} />
                )}
                {tipoAumento === 'um' && (
                  <div className="subida-dois">
                    <SeletorAtributo valor={atributosUm[0]} aoMudar={(a) => setAtributosUm([a, atributosUm[1]])} nomes={regras.atributos} />
                    <SeletorAtributo valor={atributosUm[1]} aoMudar={(a) => setAtributosUm([atributosUm[0], a])} nomes={regras.atributos} />
                  </div>
                )}
                {tipoAumento === 'talento' && (
                  <label className="campo">
                    <span>Talento</span>
                    <select value={talentoId} onChange={(e) => setTalentoId(e.target.value)}>
                      <option value="">{talentos.length > 0 ? 'Escolha…' : 'Nenhum talento no compêndio'}</option>
                      {talentos.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </section>
            )}

            {subida.entrada.dados.atributoConjuracao && (
              <section>
                <h4>Magias novas</h4>
                {guia && (
                  <p className="tela-dica">
                    {guia.truques !== null && `A tabela indica ${guia.truques} truques no total. `}
                    {guia.magiasConhecidas !== null && `Magias conhecidas no total: ${guia.magiasConhecidas}. `}
                    Escolhidas agora: {magias.length}.
                  </p>
                )}
                {listaDeMagias.length === 0 && <p className="tela-dica">Nenhuma magia nova disponível no compêndio.</p>}
                <div className="assistente-marcas subida-magias">
                  {listaDeMagias.map((m) => (
                    <label key={m.id} className="campo-marcar" title={m.descricao.slice(0, 400)}>
                      <input
                        type="checkbox"
                        checked={magias.includes(m.id)}
                        onChange={(e) => setMagias(e.target.checked ? [...magias, m.id] : magias.filter((id) => id !== m.id))}
                      />
                      {m.nome}{' '}
                      <small>
                        {m.dados.nivel === 0 ? 'truque' : `${m.dados.nivel}º`} · {ROTULO_ESCOLA[m.dados.escola]}
                      </small>
                    </label>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h4>Antes e depois</h4>
              <dl className="subida-comparacao">
                {comparar('Pontos de vida máximos', antes.valor('pv_maximos'), calculoDepois.valor('pv_maximos'))}
                {comparar('Bônus de proficiência', antes.valor('prof'), calculoDepois.valor('prof'), true)}
                {ATRIBUTOS.map((a) => comparar(regras.atributos[a], antes.valor(a), calculoDepois.valor(a)))}
              </dl>
            </section>
          </>
        )}

        {pendencias.length > 0 && (
          <ul className="assistente-pendencias">
            {pendencias.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <div className="tela-cabecalho-acoes">
          <button type="button" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="assistente-concluir"
            disabled={pendencias.length > 0}
            onClick={() => aoConfirmar(fichaComNivel(ficha, escolhas, compendio))}
          >
            Confirmar subida
          </button>
        </div>
      </div>
    </div>
  );
}

function SeletorAtributo({
  valor,
  aoMudar,
  nomes,
}: {
  readonly valor: Atributo;
  readonly aoMudar: (atributo: Atributo) => void;
  readonly nomes: Readonly<Record<Atributo, string>>;
}) {
  return (
    <select aria-label="Atributo" value={valor} onChange={(e) => aoMudar(e.target.value as Atributo)}>
      {ATRIBUTOS.map((a) => (
        <option key={a} value={a}>
          {nomes[a]}
        </option>
      ))}
    </select>
  );
}
