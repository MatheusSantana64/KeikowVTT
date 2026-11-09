import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
} from 'react';
import type { CoordHex } from '../core/hex';
import { criarLojaMapa } from '../core/loja';
import type { Manifesto } from '../core/manifesto';
import { carregarManifesto } from '../render/assets';
import { createMapScene, type CenaMapa } from '../render/createMapScene';
import { Paleta } from './Paleta';

type Ferramenta =
  | { readonly tipo: 'nenhuma' }
  | { readonly tipo: 'pintar'; readonly terreno: string }
  | { readonly tipo: 'apagar' };

const SEM_FERRAMENTA: Ferramenta = { tipo: 'nenhuma' };
const BORRACHA: Ferramenta = { tipo: 'apagar' };

export function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const cenaRef = useRef<CenaMapa | null>(null);
  const tileArrastado = useRef<string | null>(null);
  // A cena é criada uma só vez, então lê a ferramenta atual por esta referência.
  const ferramentaRef = useRef<Ferramenta>(SEM_FERRAMENTA);
  const [loja] = useState(() => criarLojaMapa());
  const [manifesto, setManifesto] = useState<Manifesto | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [hexSobMouse, setHexSobMouse] = useState<CoordHex | null>(null);
  const [ferramenta, setFerramenta] = useState<Ferramenta>(SEM_FERRAMENTA);
  const podeDesfazer = useSyncExternalStore(loja.assinar, loja.podeDesfazer);
  const podeRefazer = useSyncExternalStore(loja.assinar, loja.podeRefazer);

  const selecionarFerramenta = useCallback((nova: Ferramenta) => {
    ferramentaRef.current = nova;
    setFerramenta(nova);
    cenaRef.current?.limparPrevia();
  }, []);

  useEffect(() => {
    carregarManifesto()
      .then(setManifesto)
      .catch((motivo: unknown) => setErro(String(motivo)));
  }, []);

  useEffect(() => {
    if (!manifesto) {
      return;
    }

    const aplicarFerramenta = (coord: CoordHex) => {
      const atual = ferramentaRef.current;
      if (atual.tipo === 'pintar') {
        loja.despachar({ tipo: 'ColocarTile', coord, terreno: atual.terreno });
      } else if (atual.tipo === 'apagar') {
        loja.despachar({ tipo: 'RemoverTile', coord });
      }
    };

    const cena = createMapScene(mapRef.current!, {
      loja,
      manifesto,
      aoMudarHexSobMouse: (coord) => {
        setHexSobMouse(coord);
        const atual = ferramentaRef.current;
        if (coord && atual.tipo === 'pintar') {
          cena.mostrarPrevia(atual.terreno, coord);
        } else {
          cena.limparPrevia();
        }
      },
      aoIniciarTraco: (coord) => {
        loja.iniciarTraco();
        aplicarFerramenta(coord);
      },
      aoContinuarTraco: aplicarFerramenta,
      aoTerminarTraco: loja.terminarTraco,
    });
    cenaRef.current = cena;
    return () => {
      cena.destruir();
      cenaRef.current = null;
    };
  }, [loja, manifesto]);

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

  const hexDoEvento = (evento: DragEvent<HTMLElement>): CoordHex | null => {
    const limites = evento.currentTarget.getBoundingClientRect();
    return (
      cenaRef.current?.hexEm(evento.clientX - limites.left, evento.clientY - limites.top) ?? null
    );
  };

  const aoArrastarSobreMapa = (evento: DragEvent<HTMLElement>) => {
    const assetId = tileArrastado.current;
    if (!assetId) {
      return;
    }
    evento.preventDefault();
    evento.dataTransfer.dropEffect = 'copy';
    const coord = hexDoEvento(evento);
    if (coord) {
      cenaRef.current?.mostrarPrevia(assetId, coord);
    }
  };

  const aoSairDoMapa = (evento: DragEvent<HTMLElement>) => {
    // Passar do mapa para a tela dentro dele também dispara este evento.
    if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) {
      cenaRef.current?.limparPrevia();
    }
  };

  const aoSoltarNoMapa = (evento: DragEvent<HTMLElement>) => {
    const terreno = tileArrastado.current;
    if (!terreno) {
      return;
    }
    evento.preventDefault();
    const coord = hexDoEvento(evento);
    if (coord) {
      loja.despachar({ tipo: 'ColocarTile', coord, terreno });
    }
    cenaRef.current?.limparPrevia();
  };

  const aoTerminarArraste = () => {
    tileArrastado.current = null;
    cenaRef.current?.limparPrevia();
  };

  const aoSelecionarTile = (assetId: string) => {
    const jaSelecionado = ferramenta.tipo === 'pintar' && ferramenta.terreno === assetId;
    selecionarFerramenta(jaSelecionado ? SEM_FERRAMENTA : { tipo: 'pintar', terreno: assetId });
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>KeikowVTT</h1>
        <dl className="ajuda">
          <dt>Pintar</dt>
          <dd>Clique em um tile e pinte com o botão esquerdo, ou arraste o tile para o mapa</dd>
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
            tileSelecionado={ferramenta.tipo === 'pintar' ? ferramenta.terreno : null}
            aoSelecionarTile={aoSelecionarTile}
            aoIniciarArraste={(assetId) => {
              tileArrastado.current = assetId;
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
