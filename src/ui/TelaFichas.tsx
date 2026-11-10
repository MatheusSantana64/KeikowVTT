import { useCallback, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react';
import type { Calculado, Calculo } from '../core/calculadora';
import {
  calcularFicha,
  habilidadesDaFicha,
  proficienciasAutomaticas,
  proficienciasDaFicha,
  usosDaHabilidade,
} from '../core/calculoDaFicha';
import type { LojaCampanha } from '../core/campanha';
import { buscarEntradas, type EstadoCompendio, type LojaCompendio } from '../core/compendio';
import { ATRIBUTOS, type Atributo, type EntradaDe } from '../core/entradas';
import {
  comClasse,
  comNivel,
  comOrigem,
  criarFicha,
  entradaDaFicha,
  fichaDeMonstro,
  fichasEmOrdem,
  nivelTotal,
  pvPorNivel,
  semClasse,
  type Ficha,
  type LojaFichas,
  type TipoFicha,
} from '../core/fichas';
import { formatarNumero } from '../core/formulas';
import { idSalvaguarda } from '../core/regras';
import { REGRAS_PADRAO } from '../core/regrasPadrao';
import { CampoNumero, CampoTexto } from './camposFormulario';
import { comSinal, ExplicacaoValor, type Explicando } from './ExplicacaoValor';
import { ROTULO_RECARGA, ROTULO_TAMANHO } from './rotulosCompendio';

const ROTULO_TIPO_FICHA: Readonly<Record<TipoFicha, string>> = {
  personagem: 'Personagem',
  npc: 'NPC',
  monstro: 'Monstro',
};

/** 0,25 vira "1/4", como nos livros. */
function formatarNivelDesafio(nd: number): string {
  return { 0.125: '1/8', 0.25: '1/4', 0.5: '1/2' }[nd] ?? formatarNumero(nd);
}

/** Por enquanto, as regras que acompanham o programa. A campanha terá as próprias no passo 12. */
const REGRAS = REGRAS_PADRAO;

interface TelaFichasProps {
  readonly lojaFichas: LojaFichas;
  readonly lojaCompendio: LojaCompendio;
  readonly lojaCampanha: LojaCampanha;
  readonly aoFechar: () => void;
}

function resumoDaFicha(ficha: Ficha): string {
  if (ficha.tipo === 'monstro') {
    const monstro = entradaDaFicha(ficha, ficha.monstroId, 'monstro');
    return monstro ? `Monstro · ND ${formatarNivelDesafio(monstro.dados.nivelDesafio)}` : 'Monstro';
  }
  const classes = ficha.classes
    .map((c) => `${entradaDaFicha(ficha, c.entradaId, 'classe')?.nome ?? '?'} ${c.nivel}`)
    .join(' / ');
  return `${ROTULO_TIPO_FICHA[ficha.tipo]}${classes ? ` · ${classes}` : ''}`;
}

export function TelaFichas({ lojaFichas, lojaCompendio, lojaCampanha, aoFechar }: TelaFichasProps) {
  const estado = useSyncExternalStore(lojaFichas.assinar, lojaFichas.obterEstado);
  const compendio = useSyncExternalStore(lojaCompendio.assinar, lojaCompendio.obterEstado);
  const campanha = useSyncExternalStore(lojaCampanha.assinar, lojaCampanha.obterEstado);
  const podeDesfazer = useSyncExternalStore(lojaFichas.assinar, lojaFichas.podeDesfazer);
  const podeRefazer = useSyncExternalStore(lojaFichas.assinar, lojaFichas.podeRefazer);
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [monstroEscolhido, setMonstroEscolhido] = useState('');

  const fichas = useMemo(() => fichasEmOrdem(estado), [estado]);
  const monstros = useMemo(() => buscarEntradas(compendio, { tipos: ['monstro'] }) as EntradaDe<'monstro'>[], [compendio]);
  const selecionada = selecionadaId ? estado.fichas[selecionadaId] : undefined;

  const criar = (tipo: Exclude<TipoFicha, 'monstro'>) => {
    const ficha = { ...criarFicha(tipo, crypto.randomUUID()), nome: tipo === 'personagem' ? 'Novo personagem' : 'Novo NPC' };
    lojaFichas.despachar({ tipo: 'CriarFicha', ficha });
    setSelecionadaId(ficha.id);
  };

  const criarMonstro = () => {
    const monstro = monstros.find((m) => m.id === monstroEscolhido);
    if (monstro) {
      const ficha = fichaDeMonstro(monstro, crypto.randomUUID());
      lojaFichas.despachar({ tipo: 'CriarFicha', ficha });
      setSelecionadaId(ficha.id);
    }
  };

  return (
    <div className="tela-sobreposta" role="dialog" aria-label="Fichas">
      <header className="tela-cabecalho">
        <h1>Fichas</h1>
        <div className="tela-cabecalho-acoes">
          <button type="button" disabled={!podeDesfazer} onClick={lojaFichas.desfazer} title="Ctrl+Z">
            Desfazer
          </button>
          <button type="button" disabled={!podeRefazer} onClick={lojaFichas.refazer} title="Ctrl+Y">
            Refazer
          </button>
        </div>
        <button type="button" className="tela-fechar" onClick={aoFechar}>
          Voltar ao mapa
        </button>
      </header>
      <div className="compendio-corpo">
        <aside className="compendio-lista">
          <div className="compendio-novo">
            <button type="button" onClick={() => criar('personagem')}>
              + Personagem
            </button>
            <button type="button" onClick={() => criar('npc')}>
              + NPC
            </button>
          </div>
          <div className="compendio-novo">
            <select
              aria-label="Monstro do compêndio"
              value={monstroEscolhido}
              onChange={(e) => setMonstroEscolhido(e.target.value)}
            >
              <option value="">{monstros.length > 0 ? 'Monstro do compêndio…' : 'Nenhum monstro no compêndio'}</option>
              {monstros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome || '(sem nome)'}
                </option>
              ))}
            </select>
            <button type="button" disabled={!monstroEscolhido} onClick={criarMonstro}>
              + Monstro
            </button>
          </div>
          <p className="tela-dica">{fichas.length === 1 ? '1 ficha' : `${fichas.length} fichas`}</p>
          <ul>
            {fichas.map((ficha) => (
              <li key={ficha.id}>
                <button
                  type="button"
                  aria-current={ficha.id === selecionadaId}
                  onClick={() => setSelecionadaId(ficha.id)}
                >
                  <span>{ficha.nome || '(sem nome)'}</span>
                  <small>{resumoDaFicha(ficha)}</small>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <main className="compendio-editor">
          {selecionada ? (
            <EditorFicha
              key={selecionada.id}
              ficha={selecionada}
              compendio={compendio}
              participantes={campanha.participantes}
              lojaFichas={lojaFichas}
              aoApagar={() => setSelecionadaId(null)}
            />
          ) : (
            <p className="tela-dica">
              Escolha uma ficha na lista ou crie uma nova. Classes, espécies e monstros vêm do compêndio: importe o SRD
              5.1 lá, se ainda não importou.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}

interface EditorFichaProps {
  readonly ficha: Ficha;
  readonly compendio: EstadoCompendio;
  readonly participantes: readonly { readonly id: string; readonly nome: string }[];
  readonly lojaFichas: LojaFichas;
  readonly aoApagar: () => void;
}

function EditorFicha({ ficha, compendio, participantes, lojaFichas, aoApagar }: EditorFichaProps) {
  const sessaoDeFoco = useRef(0);
  const [explicando, setExplicando] = useState<Explicando | null>(null);
  const [classeEscolhida, setClasseEscolhida] = useState('');
  const calculo = useMemo(() => calcularFicha(ficha, REGRAS), [ficha]);
  const fecharExplicacao = useCallback(() => setExplicando(null), []);

  const editar = (nova: Ficha, campo: string) =>
    lojaFichas.despachar({ tipo: 'EditarFicha', ficha: nova }, `${ficha.id}:${campo}:${sessaoDeFoco.current}`);

  const explicar = (evento: MouseEvent, rotulo: string, calculado: Calculado, nota?: string) => {
    const caixa = (evento.currentTarget as HTMLElement).getBoundingClientRect();
    setExplicando({ rotulo, calculado, nota, x: caixa.left, y: caixa.bottom });
  };

  const monstro = entradaDaFicha(ficha, ficha.monstroId, 'monstro');
  const daLista = (tipo: 'classe' | 'especie' | 'antecedente') => buscarEntradas(compendio, { tipos: [tipo] });

  return (
    <div
      className="ficha"
      onFocus={() => {
        sessaoDeFoco.current += 1;
      }}
    >
      <div className="editor-entrada-topo">
        <div>
          <h2>{ficha.nome || '(sem nome)'}</h2>
          <p className="tela-dica">
            {ROTULO_TIPO_FICHA[ficha.tipo]}
            {ficha.tipo !== 'monstro' && ` · nível ${Math.max(1, nivelTotal(ficha))}`}
          </p>
        </div>
        <div className="tela-cabecalho-acoes">
          <button
            type="button"
            onClick={() => {
              lojaFichas.despachar({ tipo: 'RemoverFicha', fichaId: ficha.id });
              aoApagar();
            }}
          >
            Apagar
          </button>
        </div>
      </div>

      <div className="formulario">
        <CampoTexto rotulo="Nome" valor={ficha.nome} aoMudar={(nome) => editar({ ...ficha, nome }, 'nome')} />
        <label className="campo">
          <span>Controlada por</span>
          <select value={ficha.donoId} onChange={(e) => editar({ ...ficha, donoId: e.target.value }, 'dono')}>
            {!participantes.some((p) => p.id === ficha.donoId) && <option value={ficha.donoId}>(participante removido)</option>}
            {participantes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome || 'Sem nome'}
              </option>
            ))}
          </select>
        </label>

        {ficha.tipo !== 'monstro' && (
          <>
            <SeletorOrigem
              rotulo="Espécie"
              atual={entradaDaFicha(ficha, ficha.especieId, 'especie')}
              opcoes={daLista('especie')}
              aoMudar={(id) => editar(comOrigem(ficha, compendio, 'especieId', id), 'especie')}
            />
            <SeletorOrigem
              rotulo="Antecedente"
              atual={entradaDaFicha(ficha, ficha.antecedenteId, 'antecedente')}
              opcoes={daLista('antecedente')}
              aoMudar={(id) => editar(comOrigem(ficha, compendio, 'antecedenteId', id), 'antecedente')}
            />
            <fieldset className="campo-largo editor-lista">
              <span>Classes (a primeira dá o dado de vida cheio e as salvaguardas)</span>
              {ficha.classes.map((c) => {
                const classe = entradaDaFicha(ficha, c.entradaId, 'classe');
                return (
                  <div key={c.entradaId} className="editor-lista-item">
                    <div className="editor-lista-campos">
                      <p className="ficha-classe-nome">
                        {classe?.nome ?? '?'} <small>d{classe?.dados.dadoVida}</small>
                      </p>
                      <CampoNumero
                        rotulo="Nível"
                        inteiro
                        minimo={1}
                        maximo={20}
                        valor={c.nivel}
                        aoMudar={(nivel) => nivel !== null && editar(comNivel(ficha, c.entradaId, nivel), `nivel-${c.entradaId}`)}
                      />
                    </div>
                    <button type="button" onClick={() => editar(semClasse(ficha, c.entradaId), 'classe')}>
                      Remover
                    </button>
                  </div>
                );
              })}
              <div className="compendio-novo">
                <select aria-label="Classe para acrescentar" value={classeEscolhida} onChange={(e) => setClasseEscolhida(e.target.value)}>
                  <option value="">{daLista('classe').length > 0 ? 'Escolha uma classe…' : 'Nenhuma classe no compêndio'}</option>
                  {daLista('classe')
                    .filter((c) => !ficha.classes.some((fc) => fc.entradaId === c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome || '(sem nome)'}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!classeEscolhida || nivelTotal(ficha) >= 20}
                  onClick={() => {
                    editar(comClasse(ficha, compendio, classeEscolhida), 'classe');
                    setClasseEscolhida('');
                  }}
                >
                  + Classe
                </button>
              </div>
            </fieldset>
          </>
        )}
        {monstro && <ResumoMonstro monstro={monstro} />}
      </div>

      <BlocoAtributos ficha={ficha} calculo={calculo} editar={editar} explicar={explicar} />
      <BlocoCombate ficha={ficha} calculo={calculo} editar={editar} explicar={explicar} />
      <BlocoTestes ficha={ficha} calculo={calculo} editar={editar} explicar={explicar} />
      <BlocoHabilidades ficha={ficha} calculo={calculo} />
      {ficha.tipo !== 'monstro' && <BlocoDadosDeVida ficha={ficha} editar={editar} />}

      <div className="formulario ficha-secao">
        <CampoTexto rotulo="Notas" multilinha valor={ficha.notas} aoMudar={(notas) => editar({ ...ficha, notas }, 'notas')} />
      </div>

      {explicando && <ExplicacaoValor explicando={explicando} aoFechar={fecharExplicacao} />}
    </div>
  );
}

function SeletorOrigem<T extends 'especie' | 'antecedente'>({
  rotulo,
  atual,
  opcoes,
  aoMudar,
}: {
  readonly rotulo: string;
  readonly atual: EntradaDe<T> | null;
  readonly opcoes: readonly { readonly id: string; readonly nome: string }[];
  readonly aoMudar: (id: string | null) => void;
}) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      <select value={atual?.id ?? ''} onChange={(e) => aoMudar(e.target.value || null)}>
        <option value="">Nenhum(a)</option>
        {/* A cópia da ficha continua valendo mesmo se a entrada sumir do compêndio. */}
        {atual && !opcoes.some((o) => o.id === atual.id) && <option value={atual.id}>{atual.nome} (cópia da ficha)</option>}
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome || '(sem nome)'}
          </option>
        ))}
      </select>
    </label>
  );
}

interface PropsBloco {
  readonly ficha: Ficha;
  readonly calculo: Calculo;
  readonly editar: (nova: Ficha, campo: string) => void;
  readonly explicar: (evento: MouseEvent, rotulo: string, calculado: Calculado, nota?: string) => void;
}

/** Um número clicável, que abre a explicação. Sem valor, mostra um traço e o motivo ao passar o mouse. */
function Valor({
  calculado,
  rotulo,
  explicar,
  sinal = false,
  nota,
}: {
  readonly calculado: Calculado;
  readonly rotulo: string;
  readonly explicar: PropsBloco['explicar'];
  readonly sinal?: boolean;
  readonly nota?: string;
}) {
  const texto = calculado.ok ? (sinal ? comSinal(calculado.valor) : formatarNumero(calculado.valor)) : '—';
  const mudou = calculado.ok && calculado.ajustes.some((a) => a.aplicado);
  return (
    <button
      type="button"
      className={mudou ? 'ficha-valor ficha-valor-alterado' : 'ficha-valor'}
      title={calculado.ok ? 'De onde vem este número?' : calculado.erro}
      onClick={(e) => explicar(e, rotulo, calculado, nota)}
    >
      {texto}
    </button>
  );
}

function BlocoAtributos({ ficha, calculo, editar, explicar }: PropsBloco) {
  return (
    <section className="ficha-secao">
      <h3>Atributos</h3>
      <div className="ficha-atributos">
        {ATRIBUTOS.map((atributo) => {
          const nome = REGRAS.atributos[atributo];
          return (
            <div key={atributo} className="ficha-atributo">
              <span>{nome}</span>
              <Valor calculado={calculo.modificador(atributo)} rotulo={`Modificador de ${nome}`} explicar={explicar} sinal />
              <Valor calculado={calculo.valor(atributo)} rotulo={nome} explicar={explicar} />
              <CampoNumero
                rotulo="Valor escolhido"
                inteiro
                minimo={1}
                maximo={30}
                valor={ficha.atributos[atributo]}
                aoMudar={(v) => v !== null && editar({ ...ficha, atributos: { ...ficha.atributos, [atributo]: v } }, `atributo-${atributo}`)}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BlocoCombate({ ficha, calculo, editar, explicar }: PropsBloco) {
  const pvMaximos = calculo.valor('pv_maximos');
  const maximo = pvMaximos.ok ? pvMaximos.valor : null;
  const valores = ['ca', 'iniciativa', 'deslocamento', 'prof', 'percepcao_passiva', 'cd_magia', 'ataque_magico'] as const;
  const comSinalNoValor = new Set(['iniciativa', 'prof', 'ataque_magico']);
  return (
    <section className="ficha-secao">
      <h3>Combate</h3>
      <div className="ficha-combate">
        {valores.map((id) => {
          const calculado = calculo.valor(id);
          // Quem não conjura não precisa ver CD nem ataque mágico.
          if (!calculado.ok && (id === 'cd_magia' || id === 'ataque_magico')) {
            return null;
          }
          return (
            <div key={id} className="ficha-caixa">
              <span>{calculo.rotulo(id)}</span>
              <Valor calculado={calculado} rotulo={calculo.rotulo(id)} explicar={explicar} sinal={comSinalNoValor.has(id)} />
            </div>
          );
        })}
        <div className="ficha-caixa ficha-pv">
          <span>Pontos de vida</span>
          <div>
            <CampoNumero
              rotulo="Atuais"
              inteiro
              valor={ficha.pvAtuais ?? maximo}
              vazioPermitido
              aoMudar={(v) => editar({ ...ficha, pvAtuais: v === null || v === maximo ? null : v }, 'pvAtuais')}
            />
            <span className="ficha-pv-barra">/</span>
            <Valor calculado={pvMaximos} rotulo="Pontos de vida máximos" explicar={explicar} />
          </div>
          <CampoNumero
            rotulo="Temporários"
            inteiro
            minimo={0}
            valor={ficha.pvTemporarios}
            aoMudar={(v) => v !== null && editar({ ...ficha, pvTemporarios: v }, 'pvTemporarios')}
          />
        </div>
      </div>
    </section>
  );
}

const MARCADOR: Readonly<Record<string, string>> = { '0': '○', '0.5': '◐', '1': '●', '2': '◉' };
const NOME_MULTIPLICADOR: Readonly<Record<string, string>> = {
  '0': 'sem proficiência',
  '0.5': 'metade da proficiência',
  '1': 'proficiente',
  '2': 'especialista',
};

function BlocoTestes({ ficha, calculo, editar, explicar }: PropsBloco) {
  const automaticas = proficienciasAutomaticas(ficha, REGRAS);
  const todas = proficienciasDaFicha(ficha, REGRAS);
  // Monstros já trazem os bônus prontos: os marcadores não mudariam nada.
  const marcavel = ficha.tipo !== 'monstro';

  /** Alterna entre sem, proficiente e especialista. Voltar ao valor automático tira a marcação. */
  const alternar = (id: string) => {
    const atual = todas[id]?.valor ?? 0;
    const proximo = atual >= 2 ? 0 : atual >= 1 ? 2 : 1;
    const proficiencias = { ...ficha.proficiencias };
    if ((automaticas[id]?.valor ?? 0) === proximo) {
      delete proficiencias[id];
    } else {
      proficiencias[id] = proximo;
    }
    // Cada clique é um passo de desfazer próprio, mesmo sem o foco sair do botão.
    editar({ ...ficha, proficiencias }, `proficiencia-${id}-${crypto.randomUUID()}`);
  };

  const linha = (id: string, nome: string, sigla: string) => {
    const proficiencia = todas[id];
    const valor = proficiencia?.valor ?? 0;
    const nota = `${NOME_MULTIPLICADOR[String(valor)]}${proficiencia ? ` (${proficiencia.origem})` : ''}`;
    return (
      <li key={id}>
        <button
          type="button"
          className="ficha-marcador"
          disabled={!marcavel}
          title={marcavel ? `${nota}. Clique para mudar.` : nota}
          aria-label={`${nome}: ${nota}`}
          onClick={() => alternar(id)}
        >
          {MARCADOR[String(valor)]}
        </button>
        <span>
          {nome} <small>{sigla}</small>
        </span>
        <Valor calculado={calculo.valor(id)} rotulo={nome} explicar={explicar} sinal nota={`Proficiência: ${nota}.`} />
      </li>
    );
  };

  return (
    <section className="ficha-secao ficha-testes">
      <div>
        <h3>Salvaguardas</h3>
        <ul className="ficha-lista-testes">
          {ATRIBUTOS.map((a: Atributo) => linha(idSalvaguarda(a), REGRAS.atributos[a], a.toUpperCase()))}
        </ul>
      </div>
      <div>
        <h3>Perícias</h3>
        <ul className="ficha-lista-testes">
          {REGRAS.pericias.map((p) => linha(p.id, p.nome, p.atributo.toUpperCase()))}
        </ul>
      </div>
    </section>
  );
}

function BlocoHabilidades({ ficha, calculo }: { readonly ficha: Ficha; readonly calculo: Calculo }) {
  const habilidades = habilidadesDaFicha(ficha);
  if (habilidades.length === 0) {
    return null;
  }
  return (
    <section className="ficha-secao">
      <h3>Habilidades</h3>
      <ul className="ficha-habilidades">
        {habilidades.map((h) => {
          const usos = usosDaHabilidade(calculo, h);
          const recarga = h.entrada.dados.usos ? ROTULO_RECARGA[h.entrada.dados.usos.recarga].toLowerCase() : '';
          return (
            <li key={h.entrada.id}>
              <details>
                <summary>
                  <span>{h.entrada.nome}</span>
                  <small>{h.origem}</small>
                  {usos && (
                    <span className="ficha-usos" title={usos.ok ? `Fórmula: ${h.entrada.dados.usos?.maximo}` : usos.erro}>
                      {usos.ok ? `${formatarNumero(usos.valor)} por ${recarga}` : 'usos: —'}
                    </span>
                  )}
                </summary>
                <p>{h.entrada.descricao || 'Sem descrição.'}</p>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BlocoDadosDeVida({ ficha, editar }: { readonly ficha: Ficha; readonly editar: PropsBloco['editar'] }) {
  const niveis = pvPorNivel(ficha);
  if (niveis.length === 0) {
    return null;
  }
  return (
    <details className="ficha-secao ajuda-bloco">
      <summary>Dados de vida por nível (vazio usa a média)</summary>
      <div className="ficha-dados-vida">
        {niveis.map((n, i) => (
          <CampoNumero
            key={i}
            rotulo={`Nível ${i + 1} (d${n.dado})${n.rolado ? '' : `: ${n.valor}`}`}
            inteiro
            minimo={1}
            maximo={n.dado}
            vazioPermitido
            valor={ficha.pvPorNivel[i] ?? null}
            aoMudar={(v) => {
              const lista = [...ficha.pvPorNivel];
              while (lista.length <= i) {
                lista.push(null);
              }
              lista[i] = v;
              while (lista.length > 0 && lista[lista.length - 1] === null) {
                lista.pop();
              }
              editar({ ...ficha, pvPorNivel: lista }, `pv-${i}`);
            }}
          />
        ))}
      </div>
    </details>
  );
}

function ResumoMonstro({ monstro }: { readonly monstro: EntradaDe<'monstro'> }) {
  const d = monstro.dados;
  const linhas: [string, string][] = [
    ['Tipo', `${ROTULO_TAMANHO[d.tamanho]} ${d.tipoCriatura}, ${d.alinhamento}`],
    ['Deslocamento', d.deslocamento],
    ['Sentidos', d.sentidos],
    ['Idiomas', d.idiomas],
    ['Nível de desafio', `${formatarNivelDesafio(d.nivelDesafio)} (${d.experiencia} XP)`],
    ['Resistências', d.resistencias.join('; ')],
    ['Imunidades', [...d.imunidades, ...d.imunidadesCondicao].join('; ')],
    ['Vulnerabilidades', d.vulnerabilidades.join('; ')],
  ];
  const blocos: [string, readonly { nome: string; descricao: string }[]][] = [
    ['Traços', d.tracos],
    ['Ações', d.acoesDeCombate],
    ['Reações', d.reacoes],
    ['Ações lendárias', d.acoesLendarias],
  ];
  return (
    <div className="campo-largo ficha-monstro">
      <dl>
        {linhas
          .filter(([, valor]) => valor.trim() !== '')
          .map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt>{rotulo}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
      </dl>
      {blocos
        .filter(([, lista]) => lista.length > 0)
        .map(([titulo, lista]) => (
          <div key={titulo}>
            <h3>{titulo}</h3>
            {lista.map((b, i) => (
              <p key={i}>
                <strong>{b.nome}.</strong> {b.descricao}
              </p>
            ))}
          </div>
        ))}
    </div>
  );
}
