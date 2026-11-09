// Gera public/pacotes/srd-5.1.json a partir da base do 5e-bits, numa versão fixa.
// Uso: npm run srd
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ARQUIVOS_FONTE,
  COMMIT_5E_BITS,
  CREDITOS,
  converterSrd,
  referenciasQuebradas,
} from './converterSrd.ts';
import { lerPacote, pacoteParaObjeto, VERSAO_PACOTE } from '../../src/core/pacotes.ts';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cache = join(raiz, 'node_modules', '.cache', 'srd-5.1', COMMIT_5E_BITS);
const pastaPacotes = join(raiz, 'public', 'pacotes');
const urlBase = `https://raw.githubusercontent.com/5e-bits/5e-srd-api/${COMMIT_5E_BITS}/packages/5e-database/src/2014/en`;

async function baixar(nome) {
  const local = join(cache, `${nome}.json`);
  if (!existsSync(local)) {
    const resposta = await fetch(`${urlBase}/5e-SRD-${nome}.json`);
    if (!resposta.ok) {
      throw new Error(`Não foi possível baixar ${nome} (HTTP ${resposta.status}).`);
    }
    await writeFile(local, await resposta.text());
    console.log(`baixado: ${nome}`);
  }
  return JSON.parse(await readFile(local, 'utf8'));
}

await mkdir(cache, { recursive: true });
const fontes = Object.fromEntries(
  await Promise.all(ARQUIVOS_FONTE.map(async (nome) => [nome, await baixar(nome)])),
);

const pacote = converterSrd(fontes);
const quebradas = referenciasQuebradas(pacote);
if (quebradas.length > 0) {
  throw new Error(`Referências quebradas:\n${quebradas.join('\n')}`);
}

const texto = JSON.stringify(pacoteParaObjeto(pacote));
// O pacote passa pelo mesmo verificador que o programa usa ao abri-lo.
const conferido = lerPacote(texto);
if (!conferido.ok) {
  throw new Error(`O pacote gerado não é válido: ${conferido.erro}`);
}

await mkdir(pastaPacotes, { recursive: true });
await writeFile(join(pastaPacotes, 'srd-5.1.json'), texto);
await writeFile(
  join(pastaPacotes, 'indice.json'),
  `${JSON.stringify(
    {
      versao: VERSAO_PACOTE,
      pacotes: [
        {
          id: pacote.id,
          nome: pacote.nome,
          descricao: pacote.descricao,
          arquivo: 'srd-5.1.json',
          creditos: pacote.creditos,
        },
      ],
    },
    null,
    2,
  )}\n`,
);
await writeFile(
  join(raiz, 'CREDITOS.md'),
  `# Créditos do conteúdo\n\nO pacote \`public/pacotes/srd-5.1.json\` é gerado por \`npm run srd\`.\n\n${CREDITOS.map(
    (c) => `## ${c.titulo}\n\n${c.titulo.startsWith('Dados') ? `\`\`\`\n${c.texto}\n\`\`\`` : c.texto}\n`,
  ).join('\n')}`,
);

const contagem = {};
for (const entrada of pacote.entradas) {
  contagem[entrada.tipo] = (contagem[entrada.tipo] ?? 0) + 1;
}
console.log(`SRD 5.1: ${pacote.entradas.length} entradas, ${(texto.length / 1024 / 1024).toFixed(2)} MB`);
console.log(contagem);
