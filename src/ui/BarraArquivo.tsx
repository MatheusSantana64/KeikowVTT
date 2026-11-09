import { useRef, type ChangeEvent } from 'react';
import type { LojaGrupo } from '../core/grupo';
import type { LojaMapa } from '../core/loja';
import { criarMapaVazio, type EstadoMapa } from '../core/mapa';
import { desserializarMapa, serializarMapa } from '../core/persistencia';

export interface Mensagem {
  readonly tipo: 'info' | 'aviso' | 'erro';
  readonly texto: string;
}

interface BarraArquivoProps {
  readonly loja: LojaMapa;
  readonly lojaGrupo: LojaGrupo;
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

export function BarraArquivo({ loja, lojaGrupo, aoAbrirMapa, aoMensagem }: BarraArquivoProps) {
  const seletorRef = useRef<HTMLInputElement>(null);

  const novoMapa = () => {
    loja.despachar({ tipo: 'CarregarMapa', estado: criarMapaVazio() });
    lojaGrupo.despachar({ tipo: 'PosicionarGrupo', coord: null });
    aoMensagem({ tipo: 'info', texto: 'Novo mapa criado. Ctrl+Z traz o anterior de volta.' });
  };

  const salvar = () => {
    const nome = nomeDoArquivo();
    baixarTexto(serializarMapa(loja.obterEstado(), lojaGrupo.obterEstado()), nome);
    aoMensagem({ tipo: 'info', texto: `Salvo em Downloads como ${nome}` });
  };

  const aoEscolherArquivo = async (evento: ChangeEvent<HTMLInputElement>) => {
    const entrada = evento.currentTarget;
    const arquivo = entrada.files?.[0];
    if (!arquivo) {
      return;
    }
    const resultado = desserializarMapa(await arquivo.text());
    // Sem isso, escolher o mesmo arquivo de novo não dispararia este evento.
    entrada.value = '';
    if (!resultado.ok) {
      aoMensagem({ tipo: 'erro', texto: `Não foi possível abrir: ${resultado.erro}` });
      return;
    }
    loja.despachar({ tipo: 'CarregarMapa', estado: resultado.estado });
    lojaGrupo.despachar({ tipo: 'PosicionarGrupo', coord: resultado.grupo.posicao });
    aoMensagem({ tipo: 'info', texto: `Mapa aberto. Ctrl+Z traz o anterior de volta.` });
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
