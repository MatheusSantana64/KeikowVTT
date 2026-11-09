/** Guarda textos grandes no computador do usuário. As operações terminam depois de um tempo. */
export interface ArmazenamentoLocal {
  obter(chave: string): Promise<string | null>;
  gravar(chave: string, valor: string): Promise<void>;
}

const NOME_BANCO = 'keikow';
const VERSAO_BANCO = 1;
const COLECAO = 'documentos';

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolver, rejeitar) => {
    const pedido = indexedDB.open(NOME_BANCO, VERSAO_BANCO);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(COLECAO);
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rejeitar(pedido.error);
  });
}

/** Armazenamento com muito mais espaço que o localStorage, dentro do próprio navegador. */
export function criarArmazenamentoNavegador(): ArmazenamentoLocal {
  let conexao: Promise<IDBDatabase> | null = null;

  const obterConexao = () => {
    conexao ??= abrirBanco().catch((erro: unknown) => {
      // Sem isso, uma falha passageira ao abrir impediria todas as tentativas seguintes.
      conexao = null;
      throw erro;
    });
    return conexao;
  };

  return {
    async obter(chave) {
      const banco = await obterConexao();
      return new Promise((resolver, rejeitar) => {
        const pedido = banco.transaction(COLECAO).objectStore(COLECAO).get(chave);
        pedido.onsuccess = () => resolver((pedido.result as string | undefined) ?? null);
        pedido.onerror = () => rejeitar(pedido.error);
      });
    },

    async gravar(chave, valor) {
      const banco = await obterConexao();
      return new Promise((resolver, rejeitar) => {
        const transacao = banco.transaction(COLECAO, 'readwrite');
        transacao.objectStore(COLECAO).put(valor, chave);
        // Só está gravado de verdade quando a transação inteira termina.
        transacao.oncomplete = () => resolver();
        transacao.onerror = () => rejeitar(transacao.error);
        transacao.onabort = () => rejeitar(transacao.error);
      });
    },
  };
}

/** Pede ao navegador que não apague estes dados quando o disco estiver cheio. Ele pode recusar. */
export function pedirProtecaoDosDados(): void {
  void navigator.storage?.persist?.().catch(() => undefined);
}
