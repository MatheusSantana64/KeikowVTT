import { describe, expect, it } from 'vitest';
import { librasParaQuilos, numeroBrasileiro, pesParaMetros, textoParaMetrico } from './unidades';

describe('números', () => {
  it('converte como a edição brasileira', () => {
    expect([5, 10, 30, 60, 120, 35].map(pesParaMetros)).toEqual([1.5, 3, 9, 18, 36, 10.5]);
    expect(librasParaQuilos(3)).toBe(1.5);
  });

  it('escreve com vírgula nos decimais e ponto nos milhares', () => {
    expect(numeroBrasileiro(1.5)).toBe('1,5');
    expect(numeroBrasileiro(3000)).toBe('3.000');
    expect(numeroBrasileiro(0.1 + 0.2)).toBe('0,3');
  });
});

describe('textoParaMetrico', () => {
  it.each([
    ['within 60 feet of you', 'within 18 m of you'],
    ['a 20-foot-radius sphere', 'a 6-meter-radius sphere'],
    ['a 10-foot pole', 'a 3-meter pole'],
    ['Melee Weapon Attack: +4 to hit, reach 5 ft., one target.', 'Melee Weapon Attack: +4 to hit, reach 1,5 m, one target.'],
    ['range 80/320 ft., one target', 'range 24/96 m, one target'],
    ['30 ft., fly 60 ft. (hover)', '9 m, fly 18 m (hover)'],
    ['Speed: 50 ft/round.', 'Speed: 15 m/rodada.'],
    ['between 5 to 20 feet', 'between 1,5 to 6 m'],
    ['Carpet of Flying (3 ft. × 5 ft.)', 'Carpet of Flying (0,9 m × 1,5 m)'],
    ['Rope, hempen (50 feet)', 'Rope, hempen (15 m)'],
    ['travel 1 mile', 'travel 1,5 km'],
    ['about 6 inches in diameter', 'about 15 cm in diameter'],
    ['This 6-inch-wide box', 'This 15-cm-wide box'],
    ['it weighs 10 pounds', 'it weighs 5 kg'],
    ['a load of 80 lb.', 'a load of 40 kg'],
    ['produces 30 gallons of water', 'produces 120 L of water'],
    ['a volume of 64 cubic feet', 'a volume of 1,73 m³'],
    ['cover 1,000 square feet', 'cover 90 m²'],
    ['as low as -50 degrees Fahrenheit', 'as low as -45 °C'],
    ['contains 1d6 + 1 ounces', 'contains (1d6 + 1) × 30 ml'],
    ['falls 1d4 × 10 feet', 'falls 1d4 × 3 m'],
    ['Range 150 feet', 'Range 45 m'],
    ['up close--within 30 feet--at least once', 'up close--within 9 m--at least once'],
  ])('%j', (antes, depois) => {
    expect(textoParaMetrico(antes)).toBe(depois);
  });

  it('não mexe no que não é medida', () => {
    const texto = 'You gain a foothold. Each foot of movement costs 1 extra foot. Feet of the giant.';
    expect(textoParaMetrico(texto)).toBe(texto);
    expect(textoParaMetrico('Deslocamento de 9 m.')).toBe('Deslocamento de 9 m.');
  });

  it('converter duas vezes não muda mais nada', () => {
    const uma = textoParaMetrico('reach 5 ft., range 30/120 ft.');
    expect(textoParaMetrico(uma)).toBe(uma);
  });
});
