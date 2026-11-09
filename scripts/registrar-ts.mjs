// Permite que scripts do Node importem os arquivos .ts do projeto, que são escritos
// sem a extensão nos imports (como o Vite aceita). O Node já remove os tipos sozinho.
import { registerHooks } from 'node:module';

const SEM_EXTENSAO = /^\.{1,2}\/.*\/?[^./]+$|^\.{1,2}\/[^./]+$/;

registerHooks({
  resolve(especificador, contexto, proximo) {
    if (SEM_EXTENSAO.test(especificador)) {
      try {
        return proximo(`${especificador}.ts`, contexto);
      } catch {
        // Não é um .ts: segue a resolução normal.
      }
    }
    return proximo(especificador, contexto);
  },
});
