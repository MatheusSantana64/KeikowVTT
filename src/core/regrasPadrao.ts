import type { Regras } from './regras';

/**
 * Regras parecidas com 5e, que acompanham o programa. São dados, não código:
 * cada número da ficha sai de uma destas fórmulas.
 */
export const REGRAS_PADRAO: Regras = {
  nome: 'Regras parecidas com 5e',
  atributos: {
    for: 'Força',
    des: 'Destreza',
    con: 'Constituição',
    int: 'Inteligência',
    sab: 'Sabedoria',
    car: 'Carisma',
  },
  modificador: 'piso((valor - 10) / 2)',
  formulaPericia: 'mod(atributo) + piso(prof * proficiencia)',
  formulaSalvaguarda: 'mod(atributo) + piso(prof * proficiencia)',
  pericias: [
    { id: 'acrobacia', nome: 'Acrobacia', atributo: 'des' },
    { id: 'adestrar_animais', nome: 'Adestrar Animais', atributo: 'sab' },
    { id: 'arcanismo', nome: 'Arcanismo', atributo: 'int' },
    { id: 'atletismo', nome: 'Atletismo', atributo: 'for' },
    { id: 'atuacao', nome: 'Atuação', atributo: 'car' },
    { id: 'enganacao', nome: 'Enganação', atributo: 'car' },
    { id: 'furtividade', nome: 'Furtividade', atributo: 'des' },
    { id: 'historia', nome: 'História', atributo: 'int' },
    { id: 'intimidacao', nome: 'Intimidação', atributo: 'car' },
    { id: 'intuicao', nome: 'Intuição', atributo: 'sab' },
    { id: 'investigacao', nome: 'Investigação', atributo: 'int' },
    { id: 'medicina', nome: 'Medicina', atributo: 'sab' },
    { id: 'natureza', nome: 'Natureza', atributo: 'int' },
    { id: 'percepcao', nome: 'Percepção', atributo: 'sab' },
    { id: 'persuasao', nome: 'Persuasão', atributo: 'car' },
    { id: 'prestidigitacao', nome: 'Prestidigitação', atributo: 'des' },
    { id: 'religiao', nome: 'Religião', atributo: 'int' },
    { id: 'sobrevivencia', nome: 'Sobrevivência', atributo: 'sab' },
  ],
  valores: [
    {
      id: 'prof',
      nome: 'Bônus de proficiência',
      formula: '2 + piso((nivel - 1) / 4)',
      descricao: '+2 nos níveis 1 a 4, e +1 a cada 4 níveis depois disso.',
    },
    {
      id: 'ca',
      nome: 'Classe de Armadura',
      formula: '10 + mod(DES)',
      descricao: 'Sem armadura. Armaduras, escudos e magias entram como efeitos.',
    },
    { id: 'iniciativa', nome: 'Iniciativa', formula: 'mod(DES)', descricao: '' },
    { id: 'deslocamento', nome: 'Deslocamento', formula: 'deslocamento_base', descricao: 'Em pés.' },
    {
      id: 'pv_maximos',
      nome: 'Pontos de vida máximos',
      formula: 'pv_dos_dados + nivel * mod(CON)',
      descricao: 'Os dados de vida de cada nível, mais o modificador de Constituição por nível.',
    },
    { id: 'percepcao_passiva', nome: 'Percepção passiva', formula: '10 + percepcao', descricao: '' },
    {
      id: 'cd_magia',
      nome: 'CD de magia',
      formula: '8 + prof + mod(conjuracao)',
      descricao: 'Só para quem conjura magias.',
    },
    {
      id: 'ataque_magico',
      nome: 'Ataque mágico',
      formula: 'prof + mod(conjuracao)',
      descricao: 'Só para quem conjura magias.',
    },
    { id: 'capacidade_carga', nome: 'Capacidade de carga', formula: 'FOR * 15', descricao: 'Em libras.' },
  ],
};
