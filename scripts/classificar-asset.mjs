// Regra que define o tipo de cada imagem pelo começo do nome do arquivo:
//   hexRiver...  sobreposição (proporção 2:3)
//   hexUnder...  base         (proporção 4:3)
//   hex...       tile         (proporção 2:3)
//   outro nome   decoração    (qualquer tamanho, desenhada no tamanho original)

/** Largura de um hex no mundo: imagens baseadas em hex são ajustadas para ela. */
const LARGURA_HEX = 256;

/** Imagens com nome de hex que, na verdade, são decorações. */
const DECORACOES_COM_NOME_HEX = new Set(['hexPortCentre00']);

function exigirProporcao(id, largura, altura, proporcaoLargura, proporcaoAltura) {
  if (largura * proporcaoAltura !== altura * proporcaoLargura) {
    throw new Error(
      `"${id}" tem ${largura}×${altura}, mas precisa ter proporção ${proporcaoLargura}:${proporcaoAltura}. ` +
        'Corrija o tamanho da imagem. Se for uma decoração, tire o "hex" do começo do nome.',
    );
  }
}

/** Devolve o tipo, a escala e o ponto de encaixe de uma imagem. Lança erro se a proporção estiver errada. */
export function classificarAsset(id, largura, altura) {
  if (!id.startsWith('hex') || DECORACOES_COM_NOME_HEX.has(id)) {
    return { tipo: 'decoracao', escala: 1, ancora: { x: largura / 2, y: altura / 2 } };
  }

  const escala = LARGURA_HEX / largura;

  if (id.startsWith('hexUnder')) {
    // "Saia" em V: o ponto a 1/3 da altura encosta na ponta inferior do hex.
    exigirProporcao(id, largura, altura, 4, 3);
    return { tipo: 'base', escala, ancora: { x: largura / 2, y: altura / 3 } };
  }

  exigirProporcao(id, largura, altura, 2, 3);

  if (id.startsWith('hexRiver')) {
    // Só o rio é desenhado, o resto é transparente: vai por cima de um terreno.
    // O ponto a 2/3 da altura é o centro do chão do hex.
    return { tipo: 'sobreposicao', escala, ancora: { x: largura / 2, y: (altura * 2) / 3 } };
  }

  return { tipo: 'tile', escala, ancora: { x: largura / 2, y: altura } };
}
