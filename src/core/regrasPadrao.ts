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
  // 50 moedas pesam 0,5 kg, como no 5e.
  pesoPorMoeda: 0.01,
  pericias: [
    // Os apelidos em inglês permitem ler monstros e antecedentes do SRD.
    { id: 'acrobacia', nome: 'Acrobacia', atributo: 'des', apelidos: ['Acrobatics'] },
    { id: 'adestrar_animais', nome: 'Adestrar Animais', atributo: 'sab', apelidos: ['Animal Handling'] },
    { id: 'arcanismo', nome: 'Arcanismo', atributo: 'int', apelidos: ['Arcana'] },
    { id: 'atletismo', nome: 'Atletismo', atributo: 'for', apelidos: ['Athletics'] },
    { id: 'atuacao', nome: 'Atuação', atributo: 'car', apelidos: ['Performance'] },
    { id: 'enganacao', nome: 'Enganação', atributo: 'car', apelidos: ['Deception'] },
    { id: 'furtividade', nome: 'Furtividade', atributo: 'des', apelidos: ['Stealth'] },
    { id: 'historia', nome: 'História', atributo: 'int', apelidos: ['History'] },
    { id: 'intimidacao', nome: 'Intimidação', atributo: 'car', apelidos: ['Intimidation'] },
    { id: 'intuicao', nome: 'Intuição', atributo: 'sab', apelidos: ['Insight'] },
    { id: 'investigacao', nome: 'Investigação', atributo: 'int', apelidos: ['Investigation'] },
    { id: 'medicina', nome: 'Medicina', atributo: 'sab', apelidos: ['Medicine'] },
    { id: 'natureza', nome: 'Natureza', atributo: 'int', apelidos: ['Nature'] },
    { id: 'percepcao', nome: 'Percepção', atributo: 'sab', apelidos: ['Perception'] },
    { id: 'persuasao', nome: 'Persuasão', atributo: 'car', apelidos: ['Persuasion'] },
    { id: 'prestidigitacao', nome: 'Prestidigitação', atributo: 'des', apelidos: ['Sleight of Hand'] },
    { id: 'religiao', nome: 'Religião', atributo: 'int', apelidos: ['Religion'] },
    { id: 'sobrevivencia', nome: 'Sobrevivência', atributo: 'sab', apelidos: ['Survival'] },
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
    { id: 'deslocamento', nome: 'Deslocamento', formula: 'deslocamento_base', descricao: 'Em metros.' },
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
    { id: 'capacidade_carga', nome: 'Capacidade de carga', formula: 'FOR * 7.5', descricao: 'Em quilos.' },
  ],
};
