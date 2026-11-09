import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
} from 'react';
import type { CoordHex, PontoMundo } from '../core/hex';
import { criarLojaMapa } from '../core/loja';
import type { EstadoMapa } from '../core/mapa';
import type { Manifesto } from '../core/manifesto';
import { assetsDesconhecidos } from '../core/persistencia';
import { lerSalvamentoLocal, manterSalvamentoLocal } from '../net/salvamentoLocal';
import { carregarManifesto } from '../render/assets';
import { createMapScene, type CenaMapa } from '../render/createMapScene';
import { BarraArquivo, type Mensagem } from './BarraArquivo';
import { criarControlador, SEM_FERRAMENTA, type Ferramenta } from './controladorFerramentas';
import { PainelHex } from './PainelHex';
import { Paleta } from './Paleta';

const BORRACHA: Ferramenta = { tipo: 'apagar' };
const DURACAO_MENSAGEM_MS = 6000;

function iniciarEditor(): { loja: ReturnType<typeof criarLojaMapa>; aviso: Mensagem | null } {
  const salvo = lerSalvamentoLocal();
  if (salvo && !salvo.ok) {
    return {
      loja: criarLojaMapa(),
      aviso: { tipo: 'erro', texto: `O salvamento automático não pôde ser lido: ${salvo.erro}` },
    };
  }
  return { loja: criarLojaMapa(salvo?.estado), aviso: null };
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

export function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const cenaRef = useRef<CenaMapa | null>(null);
  const assetArrastado = useRef<string | null>(null);
  const [{ loja, aviso }] = useState(iniciarEditor);
  const [manifesto, setManifesto] = useState<Manifesto | null>(null);
  const [mensagem, setMensagem] = useState<Mensagem | null>(aviso);
  const [hexSobMouse, setHexSobMouse] = useState<CoordHex | null>(null);
  const [ferramenta, setFerramenta] = useState<Ferramenta>(SEM_FERRAMENTA);
  const podeDesfazer = useSyncExternalStore(loja.assinar, loja.podeDesfazer);
  const podeRefazer = useSyncExternalStore(loja.assinar, loja.podeRefazer);

  const [hexSelecionado, setHexSelecionado] = useState<CoordHex | null>(null);

  const controlador = useMemo(
    () =>
      manifesto
        ? criarControlador(loja, manifesto, () => cenaRef.current, setHexSelecionado)
        : null,
    [loja, manifesto],
  );

  useEffect(() => cenaRef.current?.selecionarHex(hexSelecionado), [hexSelecionado]);

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
      manterSalvamentoLocal(loja, () =>
        setMensagem({
          tipo: 'erro',
          texto: 'O navegador recusou o salvamento automático. Use o botão Salvar.',
        }),
      ),
    [loja],
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
    if (mensagem?.tipo !== 'info') {
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
  }, [loja, manifesto, controlador]);

  useEffect(() => {
    const aoApertarTecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        if (ferramenta.tipo === 'nenhuma') {
          setHexSelecionado(null);
        } else {
          selecionarFerramenta(SEM_FERRAMENTA);
        }
        return;
      }
      if (!evento.ctrlKey && !evento.metaKey) {
        return;
      }
      const tecla = evento.key.toLowerCase();
      if (tecla === 'y' || (tecla === 'z' && evento.shiftKey)) {
        evento.preventDefault();
        loja.refazer();
      } else if (tecla === 'z') {
        evento.preventDefault();
        loja.desfazer();
      }
    };
    window.addEventListener('keydown', aoApertarTecla);
    return () => window.removeEventListener('keydown', aoApertarTecla);
  }, [loja, selecionarFerramenta, ferramenta]);

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

  const aoSelecionarAsset = (assetId: string) => {
    selecionarFerramenta(
      assetId === assetSelecionado ? SEM_FERRAMENTA : { tipo: 'colocar', assetId },
    );
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>KeikowVTT</h1>
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
            <dt>Salvamento</dt>
            <dd>O mapa fica guardado neste navegador; use Salvar para ter uma cópia em arquivo</dd>
          </dl>
        </details>
        <BarraArquivo
          loja={loja}
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
      </aside>
      <div className="area-mapa">
        <main
          className={ferramenta.tipo === 'nenhuma' ? 'map' : 'map com-ferramenta'}
          ref={mapRef}
          onDragOver={aoArrastarSobreMapa}
          onDragLeave={aoSairDoMapa}
          onDrop={aoSoltarNoMapa}
        />
        {hexSelecionado && (
          <PainelHex
            loja={loja}
            coord={hexSelecionado}
            aoFechar={() => setHexSelecionado(null)}
          />
        )}
      </div>
    </div>
  );
}
