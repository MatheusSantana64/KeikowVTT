import { useMemo, useState, type DragEvent, type MouseEvent } from 'react';
import {
  acoesDaArma,
  conjurar as conjurarMagia,
  ehAcaoDeDano,
  espacosDeMagia,
  executarAcao,
  gastarUso,
  usosDaHabilidadeNaFicha,
} from '../core/acoesDaFicha';
import type { Calculo } from '../core/calculadora';
import { buscarEntradas, type EstadoCompendio } from '../core/compendio';
import { MOEDAS, type AcaoDeEntrada, type Entrada } from '../core/entradas';
import type { ItemDoMenu } from './MenuDeContexto';
import type { Mesa } from './mesa';
import {
  comCopiaEditada,
  comExtra,
  comItem,
  comItemAvulso,
  comMoeda,
  comNota,
  comPilha,
  comSecao,
  comSecaoMovida,
  comSecaoRenomeada,
  semExtra,
  semNota,
  semPilha,
  semSecao,
  type Ficha,
} from '../core/fichas';
import { numeroNaTela } from './numeros';
import { comCartaMovida, pesoCarregado, secoesOrganizadas, type Carta } from '../core/organizacaoDaFicha';
import type { Regras } from '../core/regras';
import { CampoNumero, CampoTexto } from './camposFormulario';
import { EditorAcoes, EditorEfeitos, FormularioDados } from './FormulariosEntrada';
import { ROTULO_ESCOLA, ROTULO_MOEDA, ROTULO_RECARGA, ROTULO_TIPO } from './rotulosCompendio';

const TIPO_ARRASTE = 'application/x-keikow-carta';

interface Props {
  readonly ficha: Ficha;
  readonly compendio: EstadoCompendio;
  readonly calculo: Calculo;
  readonly regras: Regras;
  /** `campo` agrupa a digitação num passo de desfazer; ações de um clique usam um campo único. */
  readonly editar: (nova: Ficha, campo: string) => void;
  readonly mesa: Mesa;
}

/** O que o menu do botão direito de cada carta oferece. */
function itensDaCarta(carta: Carta, ficha: Ficha, mesa: Mesa, editar: Props['editar']): ItemDoMenu[] {
  const { calculo } = mesa;
  const comCritico = (acao: AcaoDeEntrada, fazer: (critico: boolean) => void): ItemDoMenu[] => [
    { rotulo: acao.rotulo, aoEscolher: () => fazer(false) },
    ...(ehAcaoDeDano(acao) ? [{ rotulo: `${acao.rotulo} (crítico, dados em dobro)`, aoEscolher: () => fazer(true) }] : []),
  ];

  if (carta.tipo === 'nota') {
    return [];
  }

  if (carta.tipo === 'item') {
    const { pilha, entrada } = carta;
    const usar = entrada.acoes.flatMap((a) =>
      comCritico(a, (critico) => mesa.fazer(executarAcao(ficha, calculo, a, { pilhaId: pilha.id }, { critico }))),
    );
    const arma = acoesDaArma(ficha, entrada).flatMap((a) =>
      comCritico(a, (critico) => mesa.fazer(executarAcao(ficha, calculo, a, { pilhaId: pilha.id }, { critico }))),
    );
    return [
      ...usar,
      ...arma,
      {
        rotulo: pilha.equipado ? 'Desequipar' : 'Equipar',
        separar: usar.length + arma.length > 0,
        aoEscolher: () => editar(comPilha(ficha, pilha.id, { equipado: !pilha.equipado }), unico('equipar')),
      },
      ...(entrada.dados.requerSintonia
        ? [
            {
              rotulo: pilha.sintonizado ? 'Desfazer a sintonia' : 'Sintonizar',
              aoEscolher: () => editar(comPilha(ficha, pilha.id, { sintonizado: !pilha.sintonizado }), unico('sintonizar')),
            },
          ]
        : []),
      {
        rotulo: 'Presentear…',
        desativado: !mesa.temOutrasFichas,
        dica: mesa.temOutrasFichas ? undefined : 'Não há outra ficha para receber.',
        aoEscolher: () => mesa.presentear(pilha.id),
      },
      { rotulo: 'Descartar', aoEscolher: () => editar(semPilha(ficha, pilha.id), unico('descartar')) },
    ];
  }

  const { entrada, extra, habilidade } = carta;
  const tirar: ItemDoMenu[] = extra
    ? [{ rotulo: 'Tirar da ficha', separar: true, aoEscolher: () => editar(semExtra(ficha, entrada.id), unico('tirar')) }]
    : [];

  if (entrada.tipo === 'magia') {
    const nivel = entrada.dados.nivel;
    let conjurar: ItemDoMenu[];
    if (nivel === 0) {
      conjurar = [{ rotulo: 'Conjurar (truque)', aoEscolher: () => mesa.fazer(conjurarMagia(ficha, calculo, entrada, 0)) }];
    } else {
      const espacos = espacosDeMagia(ficha, calculo).filter((e) => e.nivel >= nivel && e.maximo > 0);
      conjurar =
        espacos.length > 0
          ? espacos.map((e) => {
              const restantes = Math.max(0, e.maximo - e.gastos);
              return {
                rotulo: `Conjurar com espaço de ${e.nivel}º (${restantes} de ${e.maximo})`,
                desativado: restantes === 0,
                aoEscolher: () => mesa.fazer(conjurarMagia(ficha, calculo, entrada, e.nivel)),
              };
            })
          : [{ rotulo: `Conjurar (sem espaços de ${nivel}º nível)`, desativado: true, aoEscolher: () => undefined }];
    }
    // Rolar de novo, sem gastar espaço: para quando o mestre pede outra rolagem.
    const rolarDeNovo = entrada.acoes.flatMap((a) =>
      comCritico({ ...a, rotulo: `Só rolar: ${a.rotulo}` }, (critico) =>
        mesa.fazer(executarAcao(ficha, calculo, a, { extras: { valores: { nivel_espaco: Math.max(1, nivel) } } }, { critico })),
      ),
    );
    return [...conjurar, ...(rolarDeNovo.length > 0 ? [{ ...rolarDeNovo[0], separar: true }, ...rolarDeNovo.slice(1)] : []), ...tirar];
  }

  const acoes = entrada.acoes.flatMap((a) =>
    comCritico(a, (critico) => mesa.fazer(executarAcao(ficha, calculo, a, { habilidade: habilidade ?? undefined }, { critico }))),
  );
  const gastaPorConta = entrada.acoes.some((a) => a.passos.some((p) => p.tipo === 'gastarUso'));
  const usar: ItemDoMenu[] =
    habilidade && entrada.tipo === 'habilidade' && entrada.dados.usos && !gastaPorConta
      ? [{ rotulo: 'Usar (gasta 1 uso)', aoEscolher: () => mesa.fazer(gastarUso(ficha, calculo, habilidade)) }]
      : [];
  return [...usar, ...acoes, ...tirar];
}

const unico = (nome: string) => `${nome}-${crypto.randomUUID()}`;

function kg(valor: number): string {
  return `${numeroNaTela(valor)} kg`;
}

export function OrganizacaoFicha({ ficha, compendio, calculo, regras, editar, mesa }: Props) {
  const secoes = useMemo(() => secoesOrganizadas(ficha), [ficha]);
  const [aberta, setAberta] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<{ secaoId: string; posicao: number } | null>(null);
  const peso = pesoCarregado(ficha, regras);
  const capacidade = calculo.valor('capacidade_carga');
  const excedeu = capacidade.ok && peso.total > capacidade.valor;

  const mover = (chave: string, secaoId: string, posicao: number) =>
    editar(comCartaMovida(ficha, chave, secaoId, posicao), unico('mover'));

  const aoSoltar = (evento: DragEvent, secaoId: string, posicao: number) => {
    evento.preventDefault();
    const chave = evento.dataTransfer.getData(TIPO_ARRASTE);
    setAlvo(null);
    if (chave) {
      mover(chave, secaoId, posicao);
    }
  };

  /** Onde a carta vai cair: antes ou depois da carta sob o mouse, pela metade dela. */
  const aoPassarSobreCarta = (evento: DragEvent<HTMLElement>, secaoId: string, indice: number) => {
    if (!evento.dataTransfer.types.includes(TIPO_ARRASTE)) {
      return;
    }
    evento.preventDefault();
    evento.stopPropagation();
    const caixa = evento.currentTarget.getBoundingClientRect();
    const posicao = evento.clientY > caixa.top + caixa.height / 2 ? indice + 1 : indice;
    if (alvo?.secaoId !== secaoId || alvo.posicao !== posicao) {
      setAlvo({ secaoId, posicao });
    }
  };

  return (
    <section className="ficha-secao organizacao">
      <div className="organizacao-topo">
        <h3>Inventário e organização</h3>
        <p className={excedeu ? 'mensagem-erro organizacao-peso' : 'tela-dica organizacao-peso'}>
          Carregando {kg(peso.total)}
          {capacidade.ok && ` de ${kg(capacidade.valor)}`}
          {peso.moedas > 0 && ` (moedas: ${kg(peso.moedas)})`}
          {excedeu && ' — passou da capacidade de carga'}
        </p>
      </div>

      <div className="organizacao-moedas">
        {MOEDAS.map((moeda) => (
          <CampoNumero
            key={moeda}
            rotulo={ROTULO_MOEDA[moeda].replace('peças de ', '')}
            inteiro
            minimo={0}
            valor={ficha.moedas[moeda]}
            aoMudar={(v) => v !== null && editar(comMoeda(ficha, moeda, v), `moeda-${moeda}`)}
          />
        ))}
      </div>

      <BarraAdicionar ficha={ficha} compendio={compendio} editar={editar} />

      <div className="organizacao-secoes">
        {secoes.map(({ secao, cartas }, indiceSecao) => (
          <div
            key={secao.id}
            className="organizacao-secao"
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes(TIPO_ARRASTE)) {
                e.preventDefault();
                if (alvo?.secaoId !== secao.id) {
                  setAlvo({ secaoId: secao.id, posicao: cartas.length });
                }
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setAlvo(null);
              }
            }}
            onDrop={(e) => aoSoltar(e, secao.id, alvo?.secaoId === secao.id ? alvo.posicao : cartas.length)}
          >
            <header>
              <input
                type="text"
                aria-label="Nome da seção"
                value={secao.nome}
                onChange={(e) => editar(comSecaoRenomeada(ficha, secao.id, e.target.value), `secao-nome-${secao.id}`)}
              />
              <small>{cartas.length}</small>
              <button
                type="button"
                title="Subir a seção"
                disabled={indiceSecao === 0}
                onClick={() => editar(comSecaoMovida(ficha, secao.id, indiceSecao - 1), unico('secao'))}
              >
                ↑
              </button>
              <button
                type="button"
                title="Descer a seção"
                disabled={indiceSecao === secoes.length - 1}
                onClick={() => editar(comSecaoMovida(ficha, secao.id, indiceSecao + 1), unico('secao'))}
              >
                ↓
              </button>
              <button
                type="button"
                title="Apagar a seção (as cartas vão para a primeira seção)"
                disabled={secoes.length <= 1}
                onClick={() => editar(semSecao(ficha, secao.id), unico('secao'))}
              >
                Apagar
              </button>
            </header>
            <ul>
              {cartas.map((carta, indice) => (
                <li
                  key={carta.chave}
                  draggable
                  className={[
                    'organizacao-carta',
                    alvo?.secaoId === secao.id && alvo.posicao === indice ? 'alvo-antes' : '',
                    alvo?.secaoId === secao.id && alvo.posicao === indice + 1 && indice === cartas.length - 1 ? 'alvo-depois' : '',
                  ].join(' ')}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(TIPO_ARRASTE, carta.chave);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => setAlvo(null)}
                  onDragOver={(e) => aoPassarSobreCarta(e, secao.id, indice)}
                  onDrop={(e) => {
                    e.stopPropagation();
                    aoSoltar(e, secao.id, alvo?.secaoId === secao.id ? alvo.posicao : indice);
                  }}
                >
                  <CartaDaFicha
                    carta={carta}
                    ficha={ficha}
                    calculo={calculo}
                    aberta={aberta === carta.chave}
                    alternar={() => setAberta(aberta === carta.chave ? null : carta.chave)}
                    editar={editar}
                    secoes={secoes.map((s) => ({ id: s.secao.id, nome: s.secao.nome }))}
                    secaoAtual={secao.id}
                    podeSubir={indice > 0}
                    podeDescer={indice < cartas.length - 1}
                    mover={(secaoId, posicao) => mover(carta.chave, secaoId, posicao)}
                    indice={indice}
                    mesa={mesa}
                  />
                </li>
              ))}
              {cartas.length === 0 && <li className="tela-dica organizacao-vazia">Arraste cartas para cá.</li>}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Procura no compêndio itens, magias, habilidades e talentos para pôr na ficha, e cria itens avulsos, notas e seções. */
function BarraAdicionar({ ficha, compendio, editar }: Pick<Props, 'ficha' | 'compendio' | 'editar'>) {
  const [busca, setBusca] = useState('');
  const encontradas = useMemo(
    () =>
      busca.trim().length < 2
        ? []
        : buscarEntradas(compendio, { texto: busca, tipos: ['item', 'magia', 'habilidade', 'talento'] }).slice(0, 12),
    [busca, compendio],
  );

  const acrescentar = (entrada: Entrada) => {
    const nova =
      entrada.tipo === 'item'
        ? comItem(ficha, compendio, entrada.id, crypto.randomUUID())
        : comExtra(ficha, compendio, entrada.id);
    editar(nova, unico('acrescentar'));
  };

  return (
    <div className="organizacao-adicionar">
      <div className="compendio-novo">
        <input
          type="search"
          aria-label="Procurar no compêndio"
          placeholder="Procurar item, magia ou habilidade no compêndio"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <button
          type="button"
          onClick={() => editar(comItemAvulso(ficha, crypto.randomUUID(), crypto.randomUUID(), 'Item novo'), unico('avulso'))}
        >
          + Item avulso
        </button>
        <button
          type="button"
          onClick={() => editar(comNota(ficha, { id: crypto.randomUUID(), titulo: 'Nota', texto: '' }), unico('nota'))}
        >
          + Nota
        </button>
        <button type="button" onClick={() => editar(comSecao(ficha, crypto.randomUUID(), 'Nova seção'), unico('secao'))}>
          + Seção
        </button>
      </div>
      {encontradas.length > 0 && (
        <ul className="organizacao-resultados">
          {encontradas.map((entrada) => {
            const jaTem = entrada.tipo !== 'item' && ficha.extras.includes(entrada.id);
            return (
              <li key={entrada.id}>
                <button type="button" disabled={jaTem} onClick={() => acrescentar(entrada)}>
                  + {entrada.nome || '(sem nome)'} <small>{ROTULO_TIPO[entrada.tipo]}</small>
                  {jaTem && <small> · já está na ficha</small>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface PropsCarta {
  readonly carta: Carta;
  readonly ficha: Ficha;
  readonly calculo: Calculo;
  readonly aberta: boolean;
  readonly alternar: () => void;
  readonly editar: Props['editar'];
  readonly secoes: readonly { readonly id: string; readonly nome: string }[];
  readonly secaoAtual: string;
  readonly podeSubir: boolean;
  readonly podeDescer: boolean;
  readonly indice: number;
  readonly mover: (secaoId: string, posicao: number) => void;
  readonly mesa: Mesa;
}

function CartaDaFicha(props: PropsCarta) {
  const { carta, ficha, calculo, aberta, alternar, editar, secoes, secaoAtual, podeSubir, podeDescer, indice, mover, mesa } = props;
  const nomeDaCarta = carta.tipo === 'nota' ? carta.nota.titulo : carta.entrada.nome || '(sem nome)';
  const itensDoMenu = itensDaCarta(carta, ficha, mesa, editar);
  const abrirMenu = (e: MouseEvent) => {
    if (itensDoMenu.length > 0) {
      mesa.menu(e, nomeDaCarta, itensDoMenu);
    }
  };
  const botaoDoMenu =
    itensDoMenu.length > 0 ? (
      <button type="button" className="carta-menu" title="Ações (ou clique com o botão direito na carta)" onClick={abrirMenu}>
        ⋯
      </button>
    ) : null;

  const controlesDeLugar = (
    <span className="carta-lugar">
      <button type="button" title="Subir" disabled={!podeSubir} onClick={() => mover(secaoAtual, indice - 1)}>
        ↑
      </button>
      <button type="button" title="Descer" disabled={!podeDescer} onClick={() => mover(secaoAtual, indice + 2)}>
        ↓
      </button>
      <select
        aria-label="Mover para a seção"
        value=""
        onChange={(e) => e.target.value && mover(e.target.value, Number.MAX_SAFE_INTEGER)}
      >
        <option value="">Mover…</option>
        {secoes
          .filter((s) => s.id !== secaoAtual)
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome || '(sem nome)'}
            </option>
          ))}
      </select>
    </span>
  );

  if (carta.tipo === 'nota') {
    const { nota } = carta;
    return (
      <div className="carta carta-nota">
        <div className="carta-linha">
          <input
            type="text"
            aria-label="Título da nota"
            className="carta-titulo"
            value={nota.titulo}
            onChange={(e) => editar(comNota(ficha, { ...nota, titulo: e.target.value }), `nota-titulo-${nota.id}`)}
          />
          {controlesDeLugar}
          <button type="button" onClick={() => editar(semNota(ficha, nota.id), unico('apagar-nota'))}>
            Apagar
          </button>
        </div>
        <textarea
          aria-label="Texto da nota"
          rows={3}
          value={nota.texto}
          onChange={(e) => editar(comNota(ficha, { ...nota, texto: e.target.value }), `nota-texto-${nota.id}`)}
        />
      </div>
    );
  }

  if (carta.tipo === 'item') {
    const { pilha, entrada } = carta;
    return (
      <div className="carta" onContextMenu={abrirMenu}>
        <div className="carta-linha">
          {botaoDoMenu}
          <button type="button" className="carta-nome" aria-expanded={aberta} onClick={alternar}>
            {entrada.nome || '(sem nome)'}
          </button>
          <small>{kg(entrada.dados.peso * pilha.quantidade)}</small>
          <span className="carta-quantidade">
            <button
              type="button"
              title="Menos um"
              disabled={pilha.quantidade <= 1}
              onClick={() => editar(comPilha(ficha, pilha.id, { quantidade: pilha.quantidade - 1 }), unico('quantidade'))}
            >
              −
            </button>
            <span>{pilha.quantidade}</span>
            <button
              type="button"
              title="Mais um"
              onClick={() => editar(comPilha(ficha, pilha.id, { quantidade: pilha.quantidade + 1 }), unico('quantidade'))}
            >
              +
            </button>
          </span>
          <label className="campo-marcar">
            <input
              type="checkbox"
              checked={pilha.equipado}
              onChange={(e) => editar(comPilha(ficha, pilha.id, { equipado: e.target.checked }), unico('equipar'))}
            />
            Equipado
          </label>
          {entrada.dados.requerSintonia && (
            <label className="campo-marcar">
              <input
                type="checkbox"
                checked={pilha.sintonizado}
                onChange={(e) => editar(comPilha(ficha, pilha.id, { sintonizado: e.target.checked }), unico('sintonizar'))}
              />
              Sintonizado
            </label>
          )}
          {controlesDeLugar}
          <button type="button" title="Descartar (Ctrl+Z desfaz)" onClick={() => editar(semPilha(ficha, pilha.id), unico('descartar'))}>
            Descartar
          </button>
        </div>
        {aberta && <DetalhesDaCopia entrada={entrada} ficha={ficha} editar={editar} />}
      </div>
    );
  }

  const { entrada, origem, extra, habilidade } = carta;
  const usos = habilidade ? usosDaHabilidadeNaFicha(ficha, calculo, habilidade) : null;
  const recarga = entrada.tipo === 'habilidade' && entrada.dados.usos ? ROTULO_RECARGA[entrada.dados.usos.recarga].toLowerCase() : '';
  const resumo =
    entrada.tipo === 'magia'
      ? `${entrada.dados.nivel === 0 ? 'Truque' : `${entrada.dados.nivel}º nível`} · ${ROTULO_ESCOLA[entrada.dados.escola]}`
      : origem;
  return (
    <div className="carta" onContextMenu={abrirMenu}>
      <div className="carta-linha">
        {botaoDoMenu}
        <button type="button" className="carta-nome" aria-expanded={aberta} onClick={alternar}>
          {entrada.nome || '(sem nome)'}
        </button>
        <small>{resumo}</small>
        {usos && (
          <span className="ficha-usos" title={usos.ok ? `Recupera em: ${recarga}` : usos.erro}>
            {usos.ok ? `${numeroNaTela(usos.usos.restantes)} de ${numeroNaTela(usos.usos.maximo)} · ${recarga}` : 'usos: —'}
          </span>
        )}
        {controlesDeLugar}
        {extra && (
          <button type="button" onClick={() => editar(semExtra(ficha, entrada.id), unico('tirar'))}>
            Tirar
          </button>
        )}
      </div>
      {aberta && <DetalhesDaCopia entrada={entrada} ficha={ficha} editar={editar} />}
    </div>
  );
}

/** A descrição da cópia, e o formulário para editá-la só nesta ficha. */
function DetalhesDaCopia({ entrada, ficha, editar }: { readonly entrada: Entrada; readonly ficha: Ficha; readonly editar: Props['editar'] }) {
  const [editando, setEditando] = useState(false);
  const mudar = (nova: Entrada, campo: string) => editar(comCopiaEditada(ficha, nova), `copia-${entrada.id}-${campo}`);

  if (!editando) {
    return (
      <div className="carta-detalhes">
        <p>{entrada.descricao || 'Sem descrição.'}</p>
        <button type="button" onClick={() => setEditando(true)}>
          Editar a cópia desta ficha
        </button>
      </div>
    );
  }
  return (
    <div className="carta-detalhes">
      <p className="tela-dica">As mudanças valem só para esta ficha; o compêndio não muda.</p>
      <div className="formulario">
        <CampoTexto rotulo="Nome" valor={entrada.nome} aoMudar={(nome) => mudar({ ...entrada, nome }, 'nome')} />
        <CampoTexto
          rotulo="Descrição"
          multilinha
          valor={entrada.descricao}
          aoMudar={(descricao) => mudar({ ...entrada, descricao }, 'descricao')}
        />
        <FormularioDados
          entrada={entrada}
          todas={Object.values(ficha.entradas)}
          mudar={(parcial, campo) => mudar({ ...entrada, dados: { ...entrada.dados, ...parcial } } as Entrada, `dados-${campo}`)}
        />
        <EditorEfeitos entrada={entrada} mudar={(efeitos, campo) => mudar({ ...entrada, efeitos } as Entrada, campo)} />
        <EditorAcoes entrada={entrada} mudar={(acoes, campo) => mudar({ ...entrada, acoes } as Entrada, campo)} />
      </div>
      <button type="button" onClick={() => setEditando(false)}>
        Pronto
      </button>
    </div>
  );
}
