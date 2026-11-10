import { soOMestre } from './permissoes';
import { autorDe, criarEmissor, type OpcoesRegistro } from './registro';

/** O mestre tem identidade fixa: toda campanha tem exatamente um. */
export const ID_MESTRE = 'mestre';

export interface Participante {
  readonly id: string;
  readonly nome: string;
  readonly papel: 'mestre' | 'jogador';
}

export interface EstadoCampanha {
  readonly nome: string;
  readonly participantes: readonly Participante[];
}

export type AcaoCampanha =
  | { readonly tipo: 'RenomearCampanha'; readonly nome: string }
  | { readonly tipo: 'AdicionarParticipante'; readonly id: string; readonly nome: string }
  | { readonly tipo: 'RenomearParticipante'; readonly participanteId: string; readonly nome: string }
  | { readonly tipo: 'RemoverParticipante'; readonly participanteId: string }
  | { readonly tipo: 'CarregarCampanha'; readonly estado: EstadoCampanha };

export function criarCampanhaInicial(): EstadoCampanha {
  return {
    nome: 'Minha campanha',
    participantes: [{ id: ID_MESTRE, nome: 'Mestre', papel: 'mestre' }],
  };
}

/** Uma ação sem efeito devolve o mesmo objeto, como nas ações do mapa. */
export function aplicarAcaoCampanha(estado: EstadoCampanha, acao: AcaoCampanha): EstadoCampanha {
  switch (acao.tipo) {
    case 'RenomearCampanha':
      return acao.nome === estado.nome ? estado : { ...estado, nome: acao.nome };
    case 'AdicionarParticipante':
      if (estado.participantes.some((p) => p.id === acao.id)) {
        return estado;
      }
      return {
        ...estado,
        participantes: [
          ...estado.participantes,
          { id: acao.id, nome: acao.nome, papel: 'jogador' },
        ],
      };
    case 'RenomearParticipante': {
      const alvo = estado.participantes.find((p) => p.id === acao.participanteId);
      if (!alvo || alvo.nome === acao.nome) {
        return estado;
      }
      return {
        ...estado,
        participantes: estado.participantes.map((p) =>
          p === alvo ? { ...p, nome: acao.nome } : p,
        ),
      };
    }
    case 'RemoverParticipante': {
      const alvo = estado.participantes.find((p) => p.id === acao.participanteId);
      if (!alvo || alvo.papel === 'mestre') {
        return estado;
      }
      return { ...estado, participantes: estado.participantes.filter((p) => p !== alvo) };
    }
    case 'CarregarCampanha':
      return acao.estado;
  }
}

type OuvinteCampanha = (estado: EstadoCampanha) => void;

export interface LojaCampanha {
  obterEstado(): EstadoCampanha;
  /** Ações seguidas com o mesmo `grupo` viram uma única linha no registro. */
  despachar(acao: AcaoCampanha, grupo?: string): void;
  assinar(ouvinte: OuvinteCampanha): () => void;
}

export function criarLojaCampanha(
  inicial: EstadoCampanha = criarCampanhaInicial(),
  opcoes: OpcoesRegistro = {},
): LojaCampanha {
  let estado = inicial;
  const ouvintes = new Set<OuvinteCampanha>();
  const emitir = criarEmissor(opcoes);

  return {
    obterEstado: () => estado,
    despachar(acao, grupo) {
      const novo = aplicarAcaoCampanha(estado, acao);
      const permissao = soOMestre('a campanha')(estado, novo, autorDe(opcoes));
      if (!permissao.ok) {
        opcoes.aoRecusar?.(permissao.motivo);
        return;
      }
      if (novo !== estado) {
        estado = novo;
        ouvintes.forEach((ouvinte) => ouvinte(estado));
        emitir(acao.tipo, null, grupo ?? null);
      }
    },
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
  };
}
