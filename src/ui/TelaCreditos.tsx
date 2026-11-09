import { useEffect, useState } from 'react';
import type { ResumoPacote } from '../core/pacotes';
import { carregarIndicePacotes } from '../net/pacotes';
import { ListaCreditos } from './PainelImportacao';

export function TelaCreditos({ aoFechar }: { readonly aoFechar: () => void }) {
  const [pacotes, setPacotes] = useState<readonly ResumoPacote[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void carregarIndicePacotes().then((lido) => {
      if (!ativo) {
        return;
      }
      if (lido.ok) {
        setPacotes(lido.pacotes);
      } else {
        setErro(lido.erro);
      }
    });
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <div className="tela-sobreposta" role="dialog" aria-label="Créditos">
      <header className="tela-cabecalho">
        <h1>Créditos</h1>
        <button type="button" className="tela-fechar" onClick={aoFechar}>
          Voltar ao mapa
        </button>
      </header>
      <div className="tela-conteudo">
        <p className="tela-dica">
          Autoria e licenças do conteúdo que acompanha o KeikowVTT. Este programa é compatível com a quinta edição.
        </p>
        {erro && <p className="mensagem-erro">Não foi possível ler a lista de pacotes: {erro}</p>}
        {pacotes === null && !erro && <p className="tela-dica">Carregando…</p>}
        {pacotes?.map((resumo) => (
          <section key={resumo.id}>
            <h2>Pacote {resumo.nome}</h2>
            <ListaCreditos resumo={resumo} />
          </section>
        ))}
      </div>
    </div>
  );
}
