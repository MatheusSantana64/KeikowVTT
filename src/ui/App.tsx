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
import type { Manifesto } from '../core/manifesto';
import { carregarManifesto } from '../render/assets';
import { createMapScene, type CenaMapa } from '../render/createMapScene';
import { criarControlador, SEM_FERRAMENTA, type Ferramenta } from './controladorFerramentas';
import { Paleta } from './Paleta';

const BORRACHA: Ferramenta = { tipo: 'apagar' };

export function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const cenaRef = useRef<CenaMapa | null>(null);
  const assetArrastado = useRef<string | null>(null);
  const [loja] = useState(() => criarLojaMapa());
  const [manifesto, setManifesto] = useState<Manifesto | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [hexSobMouse, setHexSobMouse] = useState<CoordHex | null>(null);
  const [ferramenta, setFerramenta] = useState<Ferramenta>(SEM_FERRAMENTA);
  const podeDesfazer = useSyncExternalStore(loja.assinar, loja.podeDesfazer);
  const podeRefazer = useSyncExternalStore(loja.assinar, loja.podeRefazer);

  const controlador = useMemo(
    () => (manifesto ? criarControlador(loja, manifesto, () => cenaRef.current) : null),
    [loja, manifesto],
  );

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
      .catch((motivo: unknown) => setErro(String(motivo)));
  }, []);

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
        selecionarFerramenta(SEM_FERRAMENTA);
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
  }, [loja, selecionarFerramenta]);

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
        <dl className="ajuda">
          <dt>Colocar</dt>
          <dd>Clique em um item e use o botão esquerdo, ou arraste o item para o mapa</dd>
          <dt>Mover decoração</dt>
          <dd>Sem ferramenta (Esc), arraste com o botão esquerdo</dd>
          <dt>Zoom e câmera</dt>
          <dd>Roda do mouse; arrastar com o botão direito ou o do meio</dd>
        </dl>
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
        {erro && <p className="erro">{erro}</p>}
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
      <main
        className={ferramenta.tipo === 'nenhuma' ? 'map' : 'map com-ferramenta'}
        ref={mapRef}
        onDragOver={aoArrastarSobreMapa}
        onDragLeave={aoSairDoMapa}
        onDrop={aoSoltarNoMapa}
      />
    </div>
  );
}
