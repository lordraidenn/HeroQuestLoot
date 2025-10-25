// classIcons.ts
export type HeroClass =
  | 'Barbar'
  | 'Zwerg'
  | 'Elfe'
  | 'Zauberer'
  | 'Ritter'
  | 'Schurke'
  | 'Mönch'
  | 'Hexe'
  | 'Barde'
  | 'Berserker'
  | 'Entdecker'
  | 'Druide'
  | 'Kleriker'
  | 'Nekromant'
  | 'Ranger'
  | 'Paladin'
  | 'Mentor';

export const getClassIcon = (cls: HeroClass) => {
  try {
    switch (cls) {
      case 'Barbar':
        return require('../../assets/barbarian_icon.png');
      case 'Zwerg':
        return require('../../assets/dwarf_icon.png');
      case 'Elfe':
        return require('../../assets/elf_icon.png');
      case 'Zauberer':
        return require('../../assets/wizard_icon.png');
      case 'Ritter':
        return require('../../assets/knight_icon.png');
      case 'Schurke':
        return require('../../assets/rogue_icon.png');
      case 'Mönch':
        return require('../../assets/monk_icon.png');
      case 'Hexe':
        return require('../../assets/witch_icon.png');
      case 'Barde':
        return require('../../assets/bard_icon.png');
      case 'Berserker':
        return require('../../assets/berserker_icon.png');
      case 'Entdecker':
        return require('../../assets/explorer_icon.png');
      case 'Druide':
        return require('../../assets/druid_icon.png');
      case 'Kleriker':
        return require('../../assets/cleric_icon.png');
      case 'Nekromant':
        return require('../../assets/necromancer_icon.png');
      case 'Ranger':
        return require('../../assets/ranger_icon.png');
      case 'Paladin':
        return require('../../assets/paladin_icon.png');
      case 'Mentor':
        return require('../../assets/mentor_icon.png');
      default:
        return require('../../assets/default_icon.png');
    }
  } catch (e) {
    console.warn(`Icon not found for class ${cls}`);
    return require('../../assets/default_icon.png');
  }
};
