/** Small, explicit reference catalogue. No inference from unrecognised drug names. */
export const medicationEffects = [
  {
    ingredient: 'olanzapina', aliases: ['olanzapina', 'olanzapine'],
    effect: 'Sono descritti aumento di peso, alterazioni della glicemia e dei lipidi. Considerare la terapia nell’interpretazione del monitoraggio nutrizionale.',
    source: 'https://www.ema.europa.eu/en/documents/product-information/zyprexa-epar-product-information_en.pdf',
    section: 'Zyprexa, RCP sezioni 4.4 e 4.8', checkedOn: '2026-09-08',
  },
  {
    ingredient: 'aripiprazolo', aliases: ['aripiprazolo', 'aripiprazole'],
    effect: 'Il diabete è riportato tra gli effetti indesiderati nell’informazione EMA. La presenza della terapia va considerata nella valutazione della glicemia.',
    source: 'https://www.ema.europa.eu/en/medicines/human/EPAR/abilify',
    section: 'Abilify, EPAR: rischi negli adulti', checkedOn: '2026-09-08',
  },
  {
    ingredient: 'semaglutide', aliases: ['semaglutide'],
    effect: 'Sono riportati diminuzione del peso ed effetti gastrointestinali. Il rischio di ipoglicemia dipende anche dall’associazione con insulina o sulfoniluree.',
    source: 'https://www.ema.europa.eu/en/documents/product-information/ozempic-epar-product-information_en.pdf',
    section: 'Ozempic, RCP sezioni 4.4 e 4.8', checkedOn: '2026-09-08',
  },
]
export function findMedicationEffect(ingredient: string) {
  return medicationEffects.find(e => e.aliases.includes(ingredient.trim().toLocaleLowerCase('it')))
}
