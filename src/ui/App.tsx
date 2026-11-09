import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
} from 'react';
import { chaveHex, type CoordHex, type PontoMundo } from '../core/hex';
import { criarLojaCampanha, ID_MESTRE, type LojaCampanha } from '../core/campanha';
import { criarLojaCompendio, type LojaCompendio } from '../core/compendio';
import { criarLojaRegistro, type LojaRegistro } from '../core/registro';
import { criarLojaGrupo, type LojaGrupo } from '../core/grupo';
import { criarLojaMapa, type LojaMapa } from '../core/loja';
import type { EstadoMapa } from '../core/mapa';
import type { Manifesto } from '../core/manifesto';
import { assetsDesconhecidos } from '../core/persistencia';
import { criarArmazenamentoNavegador, pedirProtecaoDosDados } from '../net/armazenamentoLocal';
import {
  lerCampanhaLocal,
  lerCompendioLocal,
  lerSalvamentoLocal,
  manterCampanhaLocal,
  manterCompendioLocal,
  manterSalvamentoLocal,
} from '../net/salvamentoLocal';
import { carregarManifesto } from '../render/assets';
import { createMapScene, type CenaMapa } from '../render/createMapScene';
import { BarraArquivo, type Mensagem } from './BarraArquivo';
import { criarControlador, SEM_FERRAMENTA, type Ferramenta } from './controladorFerramentas';
import { PainelHex } from './PainelHex';
import { PainelHexJogador } from './PainelHexJogador';
import { Paleta } from './Paleta';
import { SeletorAparencia } from './SeletorAparencia';
import { TelaCampanha } from './TelaCampanha';
import { TelaCompendio } from './TelaCompendio';
import { TelaCreditos } from './TelaCreditos';

const BORRACHA: Ferramenta = { tipo: 'apagar' };
const POSICIONAR: Ferramenta = { tipo: 'posicionar' };
const REVELAR: Ferramenta = { tipo: 'revelar' };
const OCULTAR: Ferramenta = { tipo: 'ocultar' };
/** Com estas ferramentas, os hexes que os jogadores não veriam ficam escurecidos. */
const FERRAMENTAS_DE_VISAO: ReadonlySet<Ferramenta['tipo']> = new Set([
  'posicionar',
  'revelar',
  'ocultar',
]);
const DURACAO_MENSAGEM_MS = 6000;

function ehCampoDeTexto(alvo: EventTarget | null): alvo is HTMLElement {
  if (!(alvo instanceof HTMLElement)) {
    return false;
  }
  // Botões de opção são INPUT, mas neles não se digita: os atalhos do mapa continuam valendo.
  if (alvo instanceof HTMLInputElement) {
    return alvo.type !== 'radio' && alvo.type !== 'checkbox';
  }
  return alvo.isContentEditable || alvo.tagName === 'TEXTAREA';
}

interface EditorCarregado {
  readonly loja: LojaMapa;
  readonly lojaGrupo: LojaGrupo;
  readonly lojaCampanha: LojaCampanha;
  readonly lojaRegistro: LojaRegistro;
  readonly lojaCompendio: LojaCompendio;
  readonly aviso: Mensagem | null;
}

/** As telas que cobrem o mapa inteiro. */
type Tela = 'campanha' | 'compendio' | 'creditos';

const ARMAZENAMENTO = criarArmazenamentoNavegador();

async function iniciarEditor(): Promise<EditorCarregado> {
  pedirProtecaoDosDados();
  const [salvo, salvaCampanha, salvoCompendio] = await Promise.all([
    lerSalvamentoLocal(ARMAZENAMENTO, localStorage),
    lerCampanhaLocal(ARMAZENAMENTO, localStorage),
    lerCompendioLocal(ARMAZENAMENTO, localStorage),
  ]);
  const campanha = salvaCampanha?.ok ? salvaCampanha : null;
  const mapa = salvo?.ok ? salvo : null;
  const compendio = salvoCompendio?.ok ? salvoCompendio : null;

  const lojaRegistro = criarLojaRegistro(campanha?.registro);
  // Enquanto não existirem contas, quem age neste computador é sempre o mestre.
  const opcoesRegistro = {
    obterAutorId: () => ID_MESTRE,
    aoExecutar: lojaRegistro.registrar,
  };

  const falha =
    (salvo && !salvo.ok && salvo.erro) ||
    (salvaCampanha && !salvaCampanha.ok && salvaCampanha.erro) ||
    (salvoCompendio && !salvoCompendio.ok && salvoCompendio.erro);
  return {
    loja: criarLojaMapa(mapa?.estado, opcoesRegistro),
    lojaGrupo: criarLojaGrupo(mapa?.grupo, opcoesRegistro),
    lojaCampanha: criarLojaCampanha(campanha?.campanha, opcoesRegistro),
    lojaRegistro,
    lojaCompendio: criarLojaCompendio(compendio?.estado, opcoesRegistro),
    aviso: falha
      ? { tipo: 'erro', texto: `O salvamento automático não pôde ser lido: ${falha}` }
      : null,
  };
}

function avisoDeImagensFaltando(estado: EstadoMapa, manifesto: Manifesto): Mensagem | null {
  const faltando = assetsDesconhecidos(estado, manifesto);
  if (faltando.length === 0) {
    return null;
  }
  return {
    tipo: 'erro',
    texto: `Imagens não encontradas, que não serão desenhadas: ${faltando.join(', ')}`,
  };
}

/** Garante um único carregamento, mesmo que o React monte o componente duas vezes. */
let carregamentoDoEditor: Promise<EditorCarregado> | null = null;

export function App() {
  const [editor, setEditor] = useState<EditorCarregado | null>(null);

  useEffect(() => {
    let ativo = true;
    carregamentoDoEditor ??= iniciarEditor();
    void carregamentoDoEditor.then((carregado) => {
      if (ativo) {
        setEditor(carregado);
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  if (!editor) {
    return <p className="carregando">Carregando…</p>;
  }
  return <Editor {...editor} />;
}

function Editor({ loja, lojaGrupo, lojaCampanha, lojaRegistro, lojaCompendio, aviso }: EditorCarregado) {
  const mapRef = useRef<HTMLDivElement>(null);
  const cenaRef = useRef<CenaMapa | null>(null);
  const assetArrastado = useRef<string | null>(null);
  const [manifesto, setManifesto] = useState<Manifesto | null>(null);
  const [mensagem, setMensagem] = useState<Mensagem | null>(aviso);
  const [hexSobMouse, setHexSobMouse] = useState<CoordHex | null>(null);
  const [ferramenta, setFerramenta] = useState<Ferramenta>(SEM_FERRAMENTA);
  const podeDesfazer = useSyncExternalStore(loja.assinar, loja.podeDesfazer);
  const podeRefazer = useSyncExternalStore(loja.assinar, loja.podeRefazer);

  const [hexSelecionado, setHexSelecionado] = useState<CoordHex | null>(null);
  const [modoJogador, setModoJogador] = useState(false);
  const [telaAberta, setTelaAberta] = useState<Tela | null>(null);
  const grupo = useSyncExternalStore(lojaGrupo.assinar, lojaGrupo.obterEstado);

  const sairDoModoJogador = useCallback(() => {
    setModoJogador(false);
    setHexSelecionado(null);
  }, []);

  const controlador = useMemo(
    () =>
      manifesto
        ? criarControlador(
            loja,
            lojaGrupo,
            manifesto,
            () => cenaRef.current,
            setHexSelecionado,
            (texto) => setMensagem({ tipo: 'aviso', texto }),
          )
        : null,
    [loja, lojaGrupo, manifesto],
  );

  useEffect(() => cenaRef.current?.selecionarHex(hexSelecionado), [hexSelecionado]);

  useEffect(() => {
    cenaRef.current?.definirConferenciaDeVisao(FERRAMENTAS_DE_VISAO.has(ferramenta.tipo));
  }, [ferramenta]);

  useEffect(() => {
    controlador?.definirSomenteLeitura(modoJogador);
    cenaRef.current?.definirModoJogador(modoJogador);
  }, [controlador, modoJogador]);

  const selecionarFerramenta = useCallback(
    (nova: Ferramenta) => {
      controlador?.definirFerramenta(nova);
      setFerramenta(nova);
    },
    [controlador],
  );

  useEffect(() => {
    carregarManifesto()
      .then(setManifesto)
      .catch((motivo: unknown) => setMensagem({ tipo: 'erro', texto: String(motivo) }));
  }, []);

  useEffect(
    () =>
      manterSalvamentoLocal(
        loja,
        lojaGrupo,
        () =>
          setMensagem({
            tipo: 'erro',
            texto: 'O navegador recusou o salvamento automático. Use o botão Salvar.',
          }),
        ARMAZENAMENTO,
        localStorage,
      ),
    [loja, lojaGrupo],
  );

  useEffect(
    () =>
      manterCampanhaLocal(
        lojaCampanha,
        lojaRegistro,
        () =>
          setMensagem({
            tipo: 'erro',
            texto: 'O navegador recusou guardar os dados da campanha. Use o botão Salvar.',
          }),
        ARMAZENAMENTO,
        localStorage,
      ),
    [lojaCampanha, lojaRegistro],
  );

  useEffect(
    () =>
      manterCompendioLocal(
        lojaCompendio,
        () =>
          setMensagem({
            tipo: 'erro',
            texto: 'O navegador recusou guardar o compêndio. Use o botão Salvar.',
          }),
        ARMAZENAMENTO,
        localStorage,
      ),
    [lojaCompendio],
  );

  useEffect(() => {
    if (manifesto) {
      const avisoImagens = avisoDeImagensFaltando(loja.obterEstado(), manifesto);
      if (avisoImagens) {
        setMensagem(avisoImagens);
      }
    }
  }, [loja, manifesto]);

  useEffect(() => {
    if (!mensagem || mensagem.tipo === 'erro') {
      return;
    }
    const temporizador = setTimeout(() => setMensagem(null), DURACAO_MENSAGEM_MS);
    return () => clearTimeout(temporizador);
  }, [mensagem]);

  useEffect(() => {
    if (!manifesto || !controlador) {
      return;
    }
    const cena = createMapScene(mapRef.current!, {
      loja,
      lojaGrupo,
      manifesto,
      aoMudarHexSobMouse: setHexSobMouse,
      aoMoverPonteiro: controlador.aoMoverPonteiro,
      aoIniciarTraco: controlador.aoIniciarTraco,
      aoContinuarTraco: controlador.aoContinuarTraco,
      aoMoverDuranteTraco: controlador.aoMoverDuranteTraco,
      aoTerminarTraco: controlador.aoTerminarTraco,
      aoClicar: controlador.aoClicar,
    });
    cenaRef.current = cena;
    return () => {
      cena.destruir();
      cenaRef.current = null;
    };
  }, [loja, lojaGrupo, manifesto, controlador]);

  useEffect(() => {
    const aoApertarTecla = (evento: KeyboardEvent) => {
      if (ehCampoDeTexto(evento.target)) {
        // Enquanto se digita, Ctrl+Z desfaz o texto, e não o mapa. Esc só sai do campo.
        if (evento.key === 'Escape') {
          evento.target.blur();
        }
        return;
      }
      const tecla = evento.key.toLowerCase();
      const comCtrl = evento.ctrlKey || evento.metaKey;
      const refazer = comCtrl && (tecla === 'y' || (tecla === 'z' && evento.shiftKey));
      const desfazer = comCtrl && tecla === 'z' && !evento.shiftKey;
      if ((telaAberta || modoJogador) && (refazer || desfazer)) {
        // Sem isto, o navegador desfaria o último texto digitado, mesmo fora do campo.
        evento.preventDefault();
      }
      if (telaAberta) {
        // O mapa está coberto: os atalhos dele não podem agir sem que ele apareça.
        if (evento.key === 'Escape') {
          setTelaAberta(null);
        } else if (telaAberta === 'compendio' && desfazer) {
          lojaCompendio.desfazer();
        } else if (telaAberta === 'compendio' && refazer) {
          lojaCompendio.refazer();
        }
        return;
      }
      if (modoJogador) {
        // O modo jogador só olha: nenhum atalho de edição funciona aqui.
        if (evento.key === 'Escape') {
          if (hexSelecionado) {
            setHexSelecionado(null);
          } else {
            sairDoModoJogador();
          }
        }
        return;
      }
      if (evento.key === 'Escape') {
        if (ferramenta.tipo === 'nenhuma') {
          setHexSelecionado(null);
        } else {
          selecionarFerramenta(SEM_FERRAMENTA);
        }
        return;
      }
      if (refazer) {
        evento.preventDefault();
        loja.refazer();
      } else if (desfazer) {
        evento.preventDefault();
        loja.desfazer();
      }
    };
    window.addEventListener('keydown', aoApertarTecla);
    return () => window.removeEventListener('keydown', aoApertarTecla);
  }, [
    loja,
    lojaCompendio,
    selecionarFerramenta,
    ferramenta,
    modoJogador,
    hexSelecionado,
    sairDoModoJogador,
    telaAberta,
  ]);

  const pontoDoEvento = (evento: DragEvent<HTMLElement>): PontoMundo | null => {
    const limites = evento.currentTarget.getBoundingClientRect();
    return (
      cenaRef.current?.mundoEm(evento.clientX - limites.left, evento.clientY - limites.top) ?? null
    );
  };

  const aoArrastarSobreMapa = (evento: DragEvent<HTMLElement>) => {
    const assetId = assetArrastado.current;
    if (!assetId) {
      return;
    }
    evento.preventDefault();
    evento.dataTransfer.dropEffect = 'copy';
    const ponto = pontoDoEvento(evento);
    if (ponto) {
      controlador?.mostrarPrevia(assetId, ponto);
    }
  };

  const aoSairDoMapa = (evento: DragEvent<HTMLElement>) => {
    // Passar do mapa para a tela dentro dele também dispara este evento.
    if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) {
      cenaRef.current?.limparPrevia();
    }
  };

  const aoSoltarNoMapa = (evento: DragEvent<HTMLElement>) => {
    const assetId = assetArrastado.current;
    if (!assetId) {
      return;
    }
    evento.preventDefault();
    const ponto = pontoDoEvento(evento);
    if (ponto) {
      controlador?.colocarAsset(assetId, ponto);
    }
    cenaRef.current?.limparPrevia();
  };

  const aoTerminarArraste = () => {
    assetArrastado.current = null;
    cenaRef.current?.limparPrevia();
  };

  const assetSelecionado = ferramenta.tipo === 'colocar' ? ferramenta.assetId : null;

  const verComoJogador = () => {
    selecionarFerramenta(SEM_FERRAMENTA);
    setHexSelecionado(null);
    setModoJogador(true);
  };

  const aoSelecionarAsset = (assetId: string) => {
    selecionarFerramenta(
      assetId === assetSelecionado ? SEM_FERRAMENTA : { tipo: 'colocar', assetId },
    );
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>KeikowVTT</h1>
        {modoJogador && (
          <>
            <p>As ferramentas de edição ficam escondidas neste modo.</p>
            {manifesto && (
              <section className="aparencia-jogador">
                <h2>Hexes não vistos</h2>
                <SeletorAparencia loja={loja} manifesto={manifesto} />
              </section>
            )}
          </>
        )}
        {!modoJogador && (
          <>
        <details className="ajuda-bloco">
          <summary>Ajuda</summary>
          <dl className="ajuda">
            <dt>Colocar</dt>
            <dd>Clique em um item e use o botão esquerdo, ou arraste o item para o mapa</dd>
            <dt>Ver um hex</dt>
            <dd>Sem ferramenta (Esc), clique no hex</dd>
            <dt>Mover decoração</dt>
            <dd>Sem ferramenta (Esc), arraste com o botão esquerdo</dd>
            <dt>Zoom e câmera</dt>
            <dd>Roda do mouse; arrastar com o botão direito ou o do meio</dd>
            <dt>Visão dos jogadores</dt>
            <dd>
              Grupo, Revelar e Ocultar escurecem o que os jogadores não veriam. O contorno verde
              marca o que foi revelado à mão
            </dd>
            <dt>Salvamento</dt>
            <dd>O mapa fica guardado neste navegador; use Salvar para ter uma cópia em arquivo</dd>
          </dl>
        </details>
        <div className="ferramentas">
          <button type="button" onClick={() => setTelaAberta('campanha')}>
            Campanha
          </button>
          <button type="button" onClick={() => setTelaAberta('compendio')}>
            Compêndio
          </button>
          <button type="button" onClick={() => setTelaAberta('creditos')}>
            Créditos
          </button>
        </div>
        <BarraArquivo
          loja={loja}
          lojaGrupo={lojaGrupo}
          lojaCampanha={lojaCampanha}
          lojaRegistro={lojaRegistro}
          lojaCompendio={lojaCompendio}
          aoAbrirMapa={(estado) => {
            setHexSelecionado(null);
            cenaRef.current?.centralizarNoMapa();
            const avisoImagens = manifesto && avisoDeImagensFaltando(estado, manifesto);
            if (avisoImagens) {
              setMensagem(avisoImagens);
            }
          }}
          aoMensagem={setMensagem}
        />
        <div className="ferramentas">
          <button
            type="button"
            aria-pressed={ferramenta.tipo === 'apagar'}
            onClick={() =>
              selecionarFerramenta(ferramenta.tipo === 'apagar' ? SEM_FERRAMENTA : BORRACHA)
            }
          >
            Borracha
          </button>
          <button type="button" disabled={!podeDesfazer} onClick={loja.desfazer} title="Ctrl+Z">
            Desfazer
          </button>
          <button type="button" disabled={!podeRefazer} onClick={loja.refazer} title="Ctrl+Y">
            Refazer
          </button>
        </div>
        <div className="ferramentas">
          {(
            [
              [POSICIONAR, 'Grupo', 'Clique em um hex para colocar o grupo nele'],
              [REVELAR, 'Revelar', 'Pinte para mostrar hexes aos jogadores'],
              [OCULTAR, 'Ocultar', 'Pinte para desfazer a revelação'],
            ] as const
          ).map(([alvo, rotulo, dica]) => (
            <button
              key={alvo.tipo}
              type="button"
              title={dica}
              aria-pressed={ferramenta.tipo === alvo.tipo}
              onClick={() =>
                selecionarFerramenta(ferramenta.tipo === alvo.tipo ? SEM_FERRAMENTA : alvo)
              }
            >
              {rotulo}
            </button>
          ))}
        </div>
        <div className="ferramentas">
          <button type="button" onClick={verComoJogador}>
            Ver como jogador
          </button>
        </div>
        {manifesto && (
          <details className="ajuda-bloco">
            <summary>Aparência dos hexes não vistos</summary>
            <SeletorAparencia loja={loja} manifesto={manifesto} />
          </details>
        )}
        <p className="coordenada">
          {hexSobMouse ? `Hex: q ${hexSobMouse.q}, r ${hexSobMouse.r}` : 'Hex: —'}
        </p>
        {mensagem && <p className={`mensagem-${mensagem.tipo}`}>{mensagem.texto}</p>}
        {manifesto && (
          <Paleta
            manifesto={manifesto}
            assetSelecionado={assetSelecionado}
            aoSelecionarAsset={aoSelecionarAsset}
            aoIniciarArraste={(assetId) => {
              assetArrastado.current = assetId;
            }}
            aoTerminarArraste={aoTerminarArraste}
          />
        )}
          </>
        )}
      </aside>
      <div className="area-mapa">
        <main
          className={ferramenta.tipo === 'nenhuma' ? 'map' : 'map com-ferramenta'}
          ref={mapRef}
          onDragOver={aoArrastarSobreMapa}
          onDragLeave={aoSairDoMapa}
          onDrop={aoSoltarNoMapa}
        />
        {modoJogador && (
          <div className="faixa-jogador">
            <span>
              Vendo como jogador
              {!grupo.posicao && ': o grupo ainda não foi posicionado'}
            </span>
            <button type="button" onClick={sairDoModoJogador}>
              Voltar ao modo mestre
            </button>
          </div>
        )}
        {hexSelecionado && modoJogador && (
          <PainelHexJogador
            key={chaveHex(hexSelecionado)}
            loja={loja}
            lojaGrupo={lojaGrupo}
            coord={hexSelecionado}
            aoFechar={() => setHexSelecionado(null)}
          />
        )}
        {hexSelecionado && !modoJogador && (
          <PainelHex
            key={chaveHex(hexSelecionado)}
            loja={loja}
            lojaGrupo={lojaGrupo}
            coord={hexSelecionado}
            aoFechar={() => setHexSelecionado(null)}
          />
        )}
      </div>
      {telaAberta === 'campanha' && (
        <TelaCampanha
          lojaCampanha={lojaCampanha}
          lojaRegistro={lojaRegistro}
          aoFechar={() => setTelaAberta(null)}
        />
      )}
      {telaAberta === 'compendio' && (
        <TelaCompendio lojaCompendio={lojaCompendio} aoFechar={() => setTelaAberta(null)} />
      )}
      {telaAberta === 'creditos' && <TelaCreditos aoFechar={() => setTelaAberta(null)} />}
    </div>
  );
}
