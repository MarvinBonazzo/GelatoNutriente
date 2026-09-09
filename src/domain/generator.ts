import { createPortion, id, totalNutrients, validateDiet } from './diet'
import type { Diet, Food, Meal, Patient } from './models'

type Slot = { names: string[]; grams: number }
const grain = ['Pasta di semola', 'Riso bianco', 'Farro', 'Cous cous', 'Quinoa']
const proteins = ['Petto di pollo', 'Merluzzo', 'Ceci', 'Salmone', 'Lenticchie', 'Tofu al naturale', 'Petto di tacchino']
const vegetables = ['Zucchine', 'Broccoli', 'Carote', 'Spinaci', 'Pomodori', 'Finocchi', 'Peperoni']
const fruits = ['Mela', 'Pera', 'Arancia', 'Kiwi', 'Fragole', 'Pesca', 'Mirtilli']
const nuts = ['Mandorle', 'Noci', 'Nocciole']
const templates: { name: string; fraction: number; slots: Slot[] }[] = [
  { name: 'Colazione', fraction: .22, slots: [{ names: ['Fiocchi di avena', 'Pane integrale', 'Fette biscottate'], grams: 45 }, { names: ['Yogurt greco bianco 0%', 'Yogurt bianco intero', 'Latte parzialmente scremato'], grams: 150 }, { names: fruits, grams: 100 }] },
  { name: 'Spuntino', fraction: .08, slots: [{ names: fruits, grams: 150 }, { names: nuts, grams: 10 }] },
  { name: 'Pranzo', fraction: .35, slots: [{ names: grain, grams: 80 }, { names: proteins, grams: 120 }, { names: vegetables, grams: 150 }, { names: ['Olio extravergine di oliva'], grams: 10 }] },
  { name: 'Merenda', fraction: .08, slots: [{ names: fruits, grams: 150 }, { names: nuts, grams: 10 }] },
  { name: 'Cena', fraction: .27, slots: [{ names: proteins, grams: 150 }, { names: ['Patate', 'Pane integrale', 'Riso integrale'], grams: 100 }, { names: vegetables, grams: 200 }, { names: ['Olio extravergine di oliva'], grams: 10 }] },
]

/** Deterministic template compiler. Energy is entered by the clinician, never inferred. */
export function generateDietDraft(diet: Diet, foods: Food[], patient: Patient | undefined, targetKcal: number, mode: 'fixed' | 'multiple') {
  if (!Number.isFinite(targetKcal) || targetKcal <= 0 || targetKcal > 10000) throw new Error('Inserisci un obiettivo energetico positivo, non oltre 10.000 kcal, definito dal nutrizionista.')
  const excluded = new Set(patient?.intake?.excludedFoodIds ?? [])
  const preferred = new Set(patient?.intake?.preferredFoodIds ?? [])
  const choose = (slot: Slot, offset: number) => {
    const candidates = slot.names.flatMap(name => foods.filter(f => f.name === name && !excluded.has(f.id)))
    const favored = candidates.filter(f => preferred.has(f.id))
    const pool = favored.length ? favored : candidates
    if (!pool.length) throw new Error(`Nessun alimento disponibile per il gruppo ${slot.names.join(', ')}. Rivedi il catalogo o compila il piano manualmente; le esclusioni non sono state ignorate.`)
    return pool[offset % pool.length]
  }
  const result = structuredClone(diet)
  result.status = 'draft'
  // The generated content must be reviewed and explicitly assigned again.
  result.patientVisible = false
  result.days = diet.days.map(day => {
    const variants = Array.from({ length: mode === 'multiple' ? 2 : 1 }, (_, v) => ({ id: id(), name: mode === 'fixed' ? 'Menu giornaliero' : `Opzione ${v + 1}`, meals: templates.map((template, mealIndex): Meal => {
      const portions = template.slots.map((slot, i) => createPortion(choose(slot, day.weekday + v + mealIndex + i), slot.grams))
      const kcal = totalNutrients(portions).kcal
      if (kcal <= 0) throw new Error('I valori energetici del catalogo non permettono di calcolare le porzioni.')
      const multiplier = targetKcal * template.fraction / kcal
      return { id: id(), name: template.name, portions: portions.map(p => ({ ...p, grams: Math.max(.1, Math.round(p.grams * multiplier * 10) / 10) })) }
    }) }))
    return { id: day.id, weekday: day.weekday, defaultVariantId: variants[0].id, variants }
  })
  validateDiet(result)
  return result
}
