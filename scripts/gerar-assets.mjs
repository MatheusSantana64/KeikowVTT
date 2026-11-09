// Copia as imagens de "Hex Samples" para public/assets e gera o manifesto.
// Rode com: npm run assets
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { classificarAsset } from './classificar-asset.mjs';

const ORIGEM = 'Hex Samples';
const DESTINO = join('public', 'assets');

/** Lê largura e altura do cabeçalho do PNG. */
function tamanhoPng(caminho) {
  const dados = readFileSync(caminho);
  return { largura: dados.readUInt32BE(16), altura: dados.readUInt32BE(20) };
}

function ordenarPorNome(entradas) {
  return entradas.sort((a, b) => a.name.localeCompare(b.name));
}

function pastas(caminho) {
  return ordenarPorNome(readdirSync(caminho, { withFileTypes: true }).filter((e) => e.isDirectory()));
}

function imagens(caminho) {
  return ordenarPorNome(
    readdirSync(caminho, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.png')),
  );
}

rmSync(DESTINO, { recursive: true, force: true });

const categorias = [];
const assets = [];
const idsUsados = new Set();

for (const pasta of pastas(ORIGEM)) {
  const nome = pasta.name.replace(/^Hex /, '');
  const categoria = nome.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  categorias.push({ id: categoria, nome });
  mkdirSync(join(DESTINO, 'tiles', categoria), { recursive: true });

  for (const imagem of imagens(join(ORIGEM, pasta.name))) {
    const id = imagem.name.replace(/\.png$/, '');
    if (idsUsados.has(id)) {
      throw new Error(`Imagem repetida em mais de uma pasta: ${id}`);
    }
    idsUsados.add(id);

    const caminhoOrigem = join(ORIGEM, pasta.name, imagem.name);
    const { largura, altura } = tamanhoPng(caminhoOrigem);
    copyFileSync(caminhoOrigem, join(DESTINO, 'tiles', categoria, imagem.name));
    assets.push({
      id,
      categoria,
      arquivo: `tiles/${categoria}/${imagem.name}`,
      largura,
      altura,
      ...classificarAsset(id, largura, altura),
    });
  }
}

writeFileSync(join(DESTINO, 'manifesto.json'), `${JSON.stringify({ categorias, assets }, null, 2)}\n`);

const contar = (tipo) => assets.filter((a) => a.tipo === tipo).length;
console.log(
  `${assets.length} imagens em ${categorias.length} categorias: ` +
    `${contar('tile')} tiles, ${contar('sobreposicao')} sobreposições, ` +
    `${contar('decoracao')} decorações, ${contar('base')} bases.`,
);
