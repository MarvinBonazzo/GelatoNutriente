import { createPortion, id, totalNutrients, validateDiet } from './diet'
import { defaultMacroTargets, macroGramTargets, validateMacroTargets, type MacroTargets } from './macros'
import type { Diet, Food, Meal, Patient, Portion } from './models'

type Slot = { names: string[]; grams: number; min: number; max: number }
type ServingGuide = Pick<Slot, 'grams' | 'min' | 'max'>
const grain = ['Pasta di semola', 'Riso bianco', 'Farro', 'Cous cous', 'Quinoa']
// Alternating lean, oily and plant sources also avoids days in which both main
// meals accidentally rely on two low-protein choices.
const proteins = ['Petto di pollo', 'Ceci', 'Petto di tacchino', 'Salmone', 'Merluzzo', 'Tonno al naturale', 'Lenticchie', 'Manzo magro', 'Tofu al naturale', 'Uovo intero', 'Orata', 'Fagioli cannellini']
const vegetables = ['Zucchine', 'Broccoli', 'Carote', 'Spinaci', 'Pomodori', 'Finocchi', 'Peperoni', 'Fagiolini verdi', 'Cavolfiore', 'Bietole', 'Asparagi']
const fruits = ['Mela', 'Pera', 'Arancia', 'Kiwi', 'Fragole', 'Pesca', 'Mirtilli']
const nuts = ['Mandorle', 'Noci', 'Nocciole']
const templates: { name: string; fraction: number; slots: Slot[] }[] = [
  { name: 'Colazione', fraction: .22, slots: [{ names: ['Fiocchi di avena', 'Pane integrale', 'Fette biscottate'], grams: 45, min: 20, max: 110 }, { names: ['Yogurt greco bianco 0%', 'Yogurt bianco intero', 'Latte parzialmente scremato'], grams: 150, min: 100, max: 250 }, { names: fruits, grams: 100, min: 50, max: 250 }] },
  { name: 'Spuntino', fraction: .08, slots: [{ names: fruits, grams: 150, min: 50, max: 250 }, { names: nuts, grams: 10, min: 5, max: 30 }] },
  { name: 'Pranzo', fraction: .35, slots: [{ names: grain, grams: 80, min: 40, max: 140 }, { names: proteins, grams: 120, min: 60, max: 250 }, { names: vegetables, grams: 150, min: 80, max: 350 }, { names: ['Olio extravergine di oliva'], grams: 10, min: 5, max: 20 }] },
  { name: 'Merenda', fraction: .08, slots: [{ names: fruits, grams: 150, min: 50, max: 250 }, { names: nuts, grams: 10, min: 5, max: 30 }] },
  { name: 'Cena', fraction: .27, slots: [{ names: proteins, grams: 150, min: 60, max: 250 }, { names: ['Patate', 'Pane integrale', 'Riso integrale'], grams: 100, min: 40, max: 220 }, { names: vegetables, grams: 200, min: 80, max: 350 }, { names: ['Olio extravergine di oliva'], grams: 10, min: 5, max: 20 }] },
]

// Food-specific guides prevent the optimizer from treating nutritionally similar
// foods as if they had the same practical serving size (for example milk and yogurt).
const servingGuides: Record<string, ServingGuide> = {
  'Latte parzialmente scremato': { grams: 200, min: 150, max: 250 },
  'Yogurt bianco intero': { grams: 150, min: 100, max: 200 },
  'Yogurt greco bianco 0%': { grams: 170, min: 100, max: 250 },
  Mandorle: { grams: 15, min: 5, max: 30 },
  Noci: { grams: 15, min: 5, max: 30 },
  Nocciole: { grams: 15, min: 5, max: 30 },
  'Olio extravergine di oliva': { grams: 10, min: 5, max: 20 },
  Salmone: { grams: 150, min: 80, max: 220 },
  'Uovo intero': { grams: 120, min: 80, max: 180 },
}

type AdjustablePortion = { portion: Portion; mealIndex: number; min: number; max: number; step: number }

function practicalStep(foodName: string) {
  if (foodName === 'Latte parzialmente scremato') return 10
  if (foodName === 'Olio extravergine di oliva' || nuts.includes(foodName)) return 1
  return 5
}

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
  // Present portions in quantities people can actually measure. The nutritional
  // values are estimates, so decimal tenths of a gram would imply false precision.
  for (const entry of entries) entry.portion.grams = Math.min(entry.max, Math.max(entry.min, Math.round(entry.portion.grams / entry.step) * entry.step))
  for (let pass = 0; pass < 12; pass++) {
    let selected: { entry: AdjustablePortion; grams: number; score: number } | undefined
    const currentScore = score()
    for (const entry of entries) {
      const original = entry.portion.grams
      for (const candidate of [original - entry.step, original + entry.step]) {
        if (candidate < entry.min || candidate > entry.max) continue
        entry.portion.grams = candidate
        const candidateScore = score()
        entry.portion.grams = original
        if (candidateScore + 1e-12 < currentScore && (!selected || candidateScore < selected.score)) selected = { entry, grams: candidate, score: candidateScore }
      }
    }
    if (!selected) break
    selected.entry.portion.grams = selected.grams
  }
  // Once the macro fit is stable, use the same measurable increments to close
  // the remaining energy gap without reintroducing fractional-gram portions.
  for (let pass = 0; pass < 30; pass++) {
    const currentError = Math.abs(targetKcal - totalNutrients(entries.map(entry => entry.portion)).kcal)
    let selected: { entry: AdjustablePortion; grams: number; error: number; score: number } | undefined
    for (const entry of entries) {
      const original = entry.portion.grams
      for (const candidate of [original - entry.step, original + entry.step]) {
        if (candidate < entry.min || candidate > entry.max) continue
        entry.portion.grams = candidate
        const error = Math.abs(targetKcal - totalNutrients(entries.map(item => item.portion)).kcal)
        const candidateScore = score()
        entry.portion.grams = original
        if (error + 1e-9 < currentError && (!selected || error < selected.error || (error === selected.error && candidateScore < selected.score))) selected = { entry, grams: candidate, error, score: candidateScore }
      }
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
          const food = choose(slot, day.weekday + v + mealIndex + i)
          const guide = servingGuides[food.name] ?? slot
          const portion = createPortion(food, guide.grams)
          adjustable.push({ portion, mealIndex, min: guide.min, max: guide.max, step: practicalStep(food.name) })
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
