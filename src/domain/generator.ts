import { createPortion, id, totalNutrients, validateDiet } from './diet'
import { defaultMacroTargets, macroGramTargets, validateMacroTargets, type MacroTargets } from './macros'
import type { Diet, Food, Meal, Patient, Portion } from './models'

type Slot = { names: string[]; grams: number; min: number; max: number }
const grain = ['Pasta di semola', 'Riso bianco', 'Farro', 'Cous cous', 'Quinoa']
const proteins = ['Petto di pollo', 'Petto di tacchino', 'Merluzzo', 'Tonno al naturale', 'Albume', 'Bresaola', 'Ceci', 'Salmone', 'Lenticchie', 'Tofu al naturale']
const vegetables = ['Zucchine', 'Broccoli', 'Carote', 'Spinaci', 'Pomodori', 'Finocchi', 'Peperoni', 'Fagiolini verdi', 'Cavolfiore', 'Bietole', 'Asparagi']
const fruits = ['Mela', 'Pera', 'Arancia', 'Kiwi', 'Fragole', 'Pesca', 'Mirtilli']
const nuts = ['Mandorle', 'Noci', 'Nocciole']
const templates: { name: string; fraction: number; slots: Slot[] }[] = [
  { name: 'Colazione', fraction: .22, slots: [{ names: ['Fiocchi di avena', 'Pane integrale', 'Fette biscottate'], grams: 45, min: 10, max: 150 }, { names: ['Yogurt greco bianco 0%', 'Yogurt bianco intero', 'Latte parzialmente scremato'], grams: 150, min: 50, max: 500 }, { names: fruits, grams: 100, min: 50, max: 400 }] },
  { name: 'Spuntino', fraction: .08, slots: [{ names: fruits, grams: 150, min: 50, max: 400 }, { names: nuts, grams: 10, min: 1, max: 80 }] },
  { name: 'Pranzo', fraction: .35, slots: [{ names: grain, grams: 80, min: 20, max: 250 }, { names: proteins, grams: 120, min: 30, max: 450 }, { names: vegetables, grams: 150, min: 50, max: 600 }, { names: ['Olio extravergine di oliva'], grams: 10, min: 1, max: 50 }] },
  { name: 'Merenda', fraction: .08, slots: [{ names: fruits, grams: 150, min: 50, max: 400 }, { names: nuts, grams: 10, min: 1, max: 80 }] },
  { name: 'Cena', fraction: .27, slots: [{ names: proteins, grams: 150, min: 30, max: 450 }, { names: ['Patate', 'Pane integrale', 'Riso integrale'], grams: 100, min: 20, max: 300 }, { names: vegetables, grams: 200, min: 50, max: 600 }, { names: ['Olio extravergine di oliva'], grams: 10, min: 1, max: 50 }] },
]

type AdjustablePortion = { portion: Portion; mealIndex: number; min: number; max: number }

function optimizePortions(entries: AdjustablePortion[], targetKcal: number, targets: MacroTargets) {
  const gramTargets = macroGramTargets(targetKcal, targets)
  const mealTargets = templates.map(template => targetKcal * template.fraction)
  const score = () => {
    const nutrients = totalNutrients(entries.map(entry => entry.portion))
    const mealKcal = templates.map((_, mealIndex) => totalNutrients(entries.filter(entry => entry.mealIndex === mealIndex).map(entry => entry.portion)).kcal)
    const relative = (actual: number, expected: number) => ((actual - expected) / Math.max(expected, 1)) ** 2
    return relative(nutrients.kcal, targetKcal) * 8
      + relative(nutrients.carbs, gramTargets.carbs) * 1.5
      + relative(nutrients.protein, gramTargets.protein) * 1.5
      + relative(nutrients.fat, gramTargets.fat) * 1.5
      + mealKcal.reduce((sum, value, index) => sum + relative(value, mealTargets[index]) * .2, 0)
  }
  const initialKcal = totalNutrients(entries.map(entry => entry.portion)).kcal
  const initialScale = targetKcal / initialKcal
  for (const entry of entries) entry.portion.grams = Math.min(entry.max, Math.max(entry.min, entry.portion.grams * initialScale))
  for (const step of [100, 50, 25, 10, 5, 2, 1, .5, .1]) {
    for (let pass = 0; pass < 12; pass++) {
      let improved = false
      for (const entry of entries) {
        const original = entry.portion.grams
        let best = original
        let bestScore = score()
        for (const candidate of [Math.max(entry.min, original - step), Math.min(entry.max, original + step)]) {
          entry.portion.grams = candidate
          const candidateScore = score()
          if (candidateScore + 1e-12 < bestScore) { best = candidate; bestScore = candidateScore; improved = true }
        }
        entry.portion.grams = best
      }
      if (!improved) break
    }
  }
  const fittedKcal = totalNutrients(entries.map(entry => entry.portion)).kcal
  const finalScale = targetKcal / fittedKcal
  for (const entry of entries) entry.portion.grams = Math.round(Math.min(entry.max, Math.max(entry.min, entry.portion.grams * finalScale)) * 10) / 10
  for (let pass = 0; pass < 5; pass++) {
    const delta = targetKcal - totalNutrients(entries.map(entry => entry.portion)).kcal
    if (Math.abs(delta) < .5) break
    let selected: { entry: AdjustablePortion; grams: number; score: number } | undefined
    for (const entry of entries) {
      const kcalPerGram = entry.portion.foodSnapshot.per100g.kcal / 100
      if (kcalPerGram <= 0) continue
      const original = entry.portion.grams
      const candidate = Math.round(Math.min(entry.max, Math.max(entry.min, original + delta / kcalPerGram)) * 10) / 10
      if (candidate === original) continue
      entry.portion.grams = candidate
      const candidateScore = score()
      entry.portion.grams = original
      if (!selected || candidateScore < selected.score) selected = { entry, grams: candidate, score: candidateScore }
    }
    if (!selected) break
    selected.entry.portion.grams = selected.grams
  }
}

/** Deterministic template compiler. It honors structured patient choices and fits clinician-defined energy and macro targets. */
export function generateDietDraft(diet: Diet, foods: Food[], patient: Patient | undefined, targetKcal: number, mode: 'fixed' | 'multiple', macroTargets?: MacroTargets) {
  if (!Number.isFinite(targetKcal) || targetKcal <= 0 || targetKcal > 10000) throw new Error('Inserisci un obiettivo energetico positivo, non oltre 10.000 kcal, definito dal nutrizionista.')
  const targets = macroTargets ?? patient?.energyProfile?.macroTargets ?? defaultMacroTargets
  validateMacroTargets(targets)
  const excluded = new Set(patient?.intake?.excludedFoodIds ?? [])
  const preferred = new Set(patient?.intake?.preferredFoodIds ?? [])
  const choose = (slot: Slot, offset: number) => {
    const candidates = slot.names.flatMap(name => foods.filter(f => f.name === name && !excluded.has(f.id)))
    const favored = candidates.filter(f => preferred.has(f.id))
    let pool = favored.length ? favored : candidates
    if (!favored.length && slot.names === proteins && targets.proteinPercent >= 28) {
      pool = [...candidates].sort((a, b) => (b.per100g.protein / Math.max(b.per100g.kcal, 1)) - (a.per100g.protein / Math.max(a.per100g.kcal, 1))).slice(0, 6)
    }
    if (!pool.length) throw new Error(`Nessun alimento disponibile per il gruppo ${slot.names.join(', ')}. Rivedi il catalogo o compila il piano manualmente; le esclusioni non sono state ignorate.`)
    return pool[offset % pool.length]
  }
  const result = structuredClone(diet)
  result.status = 'draft'
  // The generated content must be reviewed and explicitly assigned again.
  result.patientVisible = false
  result.days = diet.days.map(day => {
    const variants = Array.from({ length: mode === 'multiple' ? 2 : 1 }, (_, v) => {
      const adjustable: AdjustablePortion[] = []
      const meals = templates.map((template, mealIndex): Meal => {
        const portions = template.slots.map((slot, i) => {
          const portion = createPortion(choose(slot, day.weekday + v + mealIndex + i), slot.grams)
          adjustable.push({ portion, mealIndex, min: slot.min, max: slot.max })
          return portion
        })
        return { id: id(), name: template.name, portions }
      })
      if (totalNutrients(adjustable.map(entry => entry.portion)).kcal <= 0) throw new Error('I valori energetici del catalogo non permettono di calcolare le porzioni.')
      optimizePortions(adjustable, targetKcal, targets)
      return { id: id(), name: mode === 'fixed' ? 'Menu giornaliero' : `Opzione ${v + 1}`, meals }
    })
    return { id: day.id, weekday: day.weekday, defaultVariantId: variants[0].id, variants }
  })
  validateDiet(result)
  return result
}
