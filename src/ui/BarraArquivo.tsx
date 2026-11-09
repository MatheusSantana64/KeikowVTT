import { useRef, type ChangeEvent } from 'react';
import type { LojaGrupo } from '../core/grupo';
import type { LojaMapa } from '../core/loja';
import { criarMapaVazio, type EstadoMapa } from '../core/mapa';
import { desserializarMapa } from '../core/persistencia';
import { lerCampanhaDoArquivo, serializarArquivoCompleto } from '../core/persistenciaCampanha';
import type { LojaRegistro } from '../core/registro';
import type { LojaCampanha } from '../core/campanha';

export interface Mensagem {
  readonly tipo: 'info' | 'aviso' | 'erro';
  readonly texto: string;
}

interface BarraArquivoProps {
  readonly loja: LojaMapa;
  readonly lojaGrupo: LojaGrupo;
  readonly lojaCampanha: LojaCampanha;
  readonly lojaRegistro: LojaRegistro;
  readonly aoAbrirMapa: (estado: EstadoMapa) => void;
  readonly aoMensagem: (mensagem: Mensagem) => void;
}

function nomeDoArquivo(): string {
  const agora = new Date();
  // toISOString usa o horário universal; o ajuste faz o nome mostrar o horário local.
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60_000);
  const momento = local.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `mapa-keikow-${momento}.json`;
}

function baixarTexto(texto: string, nome: string): void {
  const endereco = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = endereco;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(endereco);
}

export function BarraArquivo({
  loja,
  lojaGrupo,
  lojaCampanha,
  lojaRegistro,
  aoAbrirMapa,
  aoMensagem,
}: BarraArquivoProps) {
  const seletorRef = useRef<HTMLInputElement>(null);

  const novoMapa = () => {
    loja.despachar({ tipo: 'CarregarMapa', estado: criarMapaVazio() });
    lojaGrupo.despachar({ tipo: 'PosicionarGrupo', coord: null });
    aoMensagem({ tipo: 'info', texto: 'Novo mapa criado. Ctrl+Z traz o anterior de volta.' });
  };

  const salvar = () => {
    const nome = nomeDoArquivo();
    baixarTexto(
      serializarArquivoCompleto(loja.obterEstado(), lojaGrupo.obterEstado(), {
        campanha: lojaCampanha.obterEstado(),
        registro: lojaRegistro.obterEntradas(),
      }),
      nome,
    );
    aoMensagem({ tipo: 'info', texto: `Salvo em Downloads como ${nome}` });
  };

  const aoEscolherArquivo = async (evento: ChangeEvent<HTMLInputElement>) => {
    const entrada = evento.currentTarget;
    const arquivo = entrada.files?.[0];
    if (!arquivo) {
      return;
    }
    const texto = await arquivo.text();
    const resultado = desserializarMapa(texto);
    const lidaCampanha = lerCampanhaDoArquivo(texto);
    // Sem isso, escolher o mesmo arquivo de novo não dispararia este evento.
    entrada.value = '';
    if (!resultado.ok || !lidaCampanha.ok) {
      const motivo = !resultado.ok ? resultado.erro : !lidaCampanha.ok ? lidaCampanha.erro : '';
      aoMensagem({ tipo: 'erro', texto: `Não foi possível abrir: ${motivo}` });
      return;
    }
    // A campanha vem primeiro para que a abertura do mapa entre no registro que veio do arquivo.
    if (lidaCampanha.conteudo) {
      lojaRegistro.substituir(lidaCampanha.conteudo.registro);
      lojaCampanha.despachar({ tipo: 'CarregarCampanha', estado: lidaCampanha.conteudo.campanha });
    }
    loja.despachar({ tipo: 'CarregarMapa', estado: resultado.estado });
    lojaGrupo.despachar({ tipo: 'PosicionarGrupo', coord: resultado.grupo.posicao });
    aoMensagem({
      tipo: 'info',
      texto: lidaCampanha.conteudo
        ? 'Campanha aberta. Ctrl+Z traz o mapa anterior de volta, mas não os jogadores.'
        : 'Mapa aberto. Ctrl+Z traz o anterior de volta.',
    });
    aoAbrirMapa(resultado.estado);
  };

  return (
    <div className="ferramentas">
      <button type="button" onClick={novoMapa}>
        Novo
      </button>
      <button type="button" onClick={salvar}>
        Salvar
      </button>
      <button type="button" onClick={() => seletorRef.current?.click()}>
        Abrir
      </button>
      <input
        ref={seletorRef}
        className="seletor-arquivo"
        type="file"
        accept=".json,application/json"
        onChange={(evento) => void aoEscolherArquivo(evento)}
      />
    </div>
  );
}
