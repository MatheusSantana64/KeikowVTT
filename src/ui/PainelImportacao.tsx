import { useEffect, useMemo, useState } from 'react';
import type { EstadoCompendio, LojaCompendio } from '../core/compendio';
import { TIPOS_ENTRADA, type TipoEntrada } from '../core/entradas';
import { contarImportacao, entradasParaImportar, type Pacote, type ResumoPacote } from '../core/pacotes';
import { carregarIndicePacotes, carregarPacote } from '../net/pacotes';
import { CampoMarcar } from './camposFormulario';
import { ROTULO_TIPO } from './rotulosCompendio';

type Carregamento<T> = { readonly estado: 'carregando' } | { readonly estado: 'erro'; readonly erro: string } | ({ readonly estado: 'pronto' } & T);

export function ListaCreditos({ resumo }: { readonly resumo: Pick<ResumoPacote, 'creditos'> }) {
  return (
    <div className="creditos">
      {resumo.creditos.map((credito) => (
        <section key={credito.titulo}>
          <h3>{credito.titulo}</h3>
          <p>{credito.texto}</p>
        </section>
      ))}
    </div>
  );
}

interface PainelImportacaoProps {
  readonly estado: EstadoCompendio;
  readonly lojaCompendio: LojaCompendio;
  readonly aoFechar: () => void;
  readonly aoImportar: (pacoteId: string, quantidade: number) => void;
}

export function PainelImportacao({ estado, lojaCompendio, aoFechar, aoImportar }: PainelImportacaoProps) {
  const [indice, setIndice] = useState<Carregamento<{ pacotes: readonly ResumoPacote[] }>>({ estado: 'carregando' });
  const [escolhido, setEscolhido] = useState<ResumoPacote | null>(null);
  const [pacote, setPacote] = useState<Carregamento<{ pacote: Pacote }> | null>(null);
  const [tipos, setTipos] = useState<ReadonlySet<TipoEntrada>>(new Set(TIPOS_ENTRADA));

  useEffect(() => {
    let ativo = true;
    void carregarIndicePacotes().then((lido) => {
      if (!ativo) {
        return;
      }
      setIndice(lido.ok ? { estado: 'pronto', pacotes: lido.pacotes } : { estado: 'erro', erro: lido.erro });
      if (lido.ok && lido.pacotes.length === 1) {
        setEscolhido(lido.pacotes[0]);
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!escolhido) {
      return;
    }
    let ativo = true;
    setPacote({ estado: 'carregando' });
    void carregarPacote(escolhido).then((lido) => {
      if (ativo) {
        setPacote(lido.ok ? { estado: 'pronto', pacote: lido.pacote } : { estado: 'erro', erro: lido.erro });
      }
    });
    return () => {
      ativo = false;
    };
  }, [escolhido]);

  const pronto = pacote?.estado === 'pronto' ? pacote.pacote : null;
  const contagem = useMemo(() => (pronto ? contarImportacao(estado, pronto) : null), [estado, pronto]);
  const aImportar = useMemo(
    () => (pronto ? entradasParaImportar(estado, pronto, tipos) : []),
    [estado, pronto, tipos],
  );

  const alternarTipo = (tipo: TipoEntrada, marcar: boolean) => {
    const novos = new Set(tipos);
    if (marcar) {
      novos.add(tipo);
    } else {
      novos.delete(tipo);
    }
    setTipos(novos);
  };

  const importar = () => {
    if (!pronto || aImportar.length === 0) {
      return;
    }
    lojaCompendio.despachar({ tipo: 'ImportarEntradas', entradas: aImportar });
    aoImportar(pronto.id, aImportar.length);
  };

  return (
    <div className="painel-importacao">
      <div className="editor-entrada-topo">
        <div>
          <h2>Importar pacote de conteúdo</h2>
          <p className="tela-dica">
            Entradas que já estão no compêndio não são substituídas, para não perder o que você editou.
          </p>
        </div>
        <div className="tela-cabecalho-acoes">
          <button type="button" onClick={aoFechar}>
            Cancelar
          </button>
        </div>
      </div>

      {indice.estado === 'carregando' && <p className="tela-dica">Procurando pacotes…</p>}
      {indice.estado === 'erro' && <p className="mensagem-erro">Não foi possível ler a lista de pacotes: {indice.erro}</p>}
      {indice.estado === 'pronto' && indice.pacotes.length > 1 && (
        <div className="ferramentas">
          {indice.pacotes.map((resumo) => (
            <button
              key={resumo.id}
              type="button"
              aria-pressed={escolhido?.id === resumo.id}
              onClick={() => setEscolhido(resumo)}
            >
              {resumo.nome}
            </button>
          ))}
        </div>
      )}

      {escolhido && (
        <>
          <h3>{escolhido.nome}</h3>
          <p>{escolhido.descricao}</p>
          <details className="ajuda-bloco">
            <summary>Créditos e licença</summary>
            <ListaCreditos resumo={escolhido} />
          </details>
        </>
      )}

      {pacote?.estado === 'carregando' && <p className="tela-dica">Carregando o pacote…</p>}
      {pacote?.estado === 'erro' && <p className="mensagem-erro">Não foi possível abrir o pacote: {pacote.erro}</p>}
      {contagem && (
        <>
          <fieldset className="campo-referencias importacao-tipos">
            <span>O que importar</span>
            <div>
              {TIPOS_ENTRADA.filter((tipo) => contagem[tipo].novas + contagem[tipo].existentes > 0).map((tipo) => (
                <CampoMarcar
                  key={tipo}
                  rotulo={`${ROTULO_TIPO[tipo]}: ${contagem[tipo].novas} nova${contagem[tipo].novas === 1 ? '' : 's'}${
                    contagem[tipo].existentes > 0 ? ` (${contagem[tipo].existentes} já no compêndio)` : ''
                  }`}
                  valor={tipos.has(tipo)}
                  aoMudar={(marcar) => alternarTipo(tipo, marcar)}
                />
              ))}
            </div>
          </fieldset>
          <div className="tela-cabecalho-acoes">
            <button type="button" disabled={aImportar.length === 0} onClick={importar}>
              {aImportar.length === 0
                ? 'Nada novo para importar'
                : `Importar ${aImportar.length} entrada${aImportar.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
