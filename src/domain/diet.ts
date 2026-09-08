import type { DayVariant, Diet, Food, Meal, Nutrients, Portion, Weekday } from './models'

export const weekdays = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
export const id = () => crypto.randomUUID()
export const now = () => new Date().toISOString()
export function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export const emptyNutrients = (): Nutrients => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 })

export function createVariant(name = 'Opzione 1'): DayVariant {
  return { id: id(), name, meals: ['Colazione', 'Spuntino', 'Pranzo', 'Merenda', 'Cena'].map(name => ({ id: id(), name, portions: [] })) }
}

export function createDiet(): Diet {
  return {
    id: id(), createdAt: now(), updatedAt: now(), schemaVersion: 1, revision: 0,
    name: 'Nuovo piano alimentare', startsOn: today(), notes: '', status: 'draft',
    days: weekdays.map((_, weekday) => {
      const variant = createVariant()
      return { id: id(), weekday: weekday as Weekday, defaultVariantId: variant.id, variants: [variant] }
    }),
  }
}

export function createPortion(food: Food, grams = 100): Portion {
  const { name, per100g, preparation, category, source } = food
  return { id: id(), foodId: food.id, grams, foodSnapshot: structuredClone({ name, per100g, preparation, category, source }) }
}

export function nutrientsForPortion(portion: Portion): Nutrients {
  const multiplier = portion.grams / 100
  return Object.fromEntries(Object.entries(portion.foodSnapshot.per100g).map(([key, value]) => [key, value * multiplier])) as unknown as Nutrients
}

export function totalNutrients(portions: Portion[]): Nutrients {
  return portions.reduce((sum, portion) => {
    const n = nutrientsForPortion(portion)
    return { kcal: sum.kcal + n.kcal, protein: sum.protein + n.protein, carbs: sum.carbs + n.carbs, fat: sum.fat + n.fat }
  }, emptyNutrients())
}

export const mealNutrients = (meal: Meal) => totalNutrients(meal.portions)
export const variantNutrients = (variant: DayVariant) => totalNutrients(variant.meals.flatMap(meal => meal.portions))

export function cloneVariant(variant: DayVariant, name: string): DayVariant {
  return { ...structuredClone(variant), id: id(), name, meals: variant.meals.map(meal => ({ ...structuredClone(meal), id: id(), portions: meal.portions.map(portion => ({ ...structuredClone(portion), id: id() })) })) }
}

export function validateDiet(diet: Diet) {
  if (!diet.name.trim()) throw new Error('Inserisci un nome per il piano.')
  if (!isLocalDate(diet.startsOn) || (diet.endsOn && (!isLocalDate(diet.endsOn) || diet.endsOn < diet.startsOn))) throw new Error('Controlla le date del piano.')
  if (diet.status === 'assigned' && !diet.patientId) throw new Error('Scegli un paziente prima di assegnare il piano.')
  if (diet.days.length !== 7 || new Set(diet.days.map(day => day.weekday)).size !== 7 || diet.days.some(day => day.weekday < 0 || day.weekday > 6)) throw new Error('Il piano deve contenere i sette giorni della settimana.')
  const identifiers = new Set<string>()
  function unique(value: string) {
    if (!value || identifiers.has(value)) throw new Error('Identificatori del piano non validi.')
    identifiers.add(value)
  }
  for (const day of diet.days) {
    unique(day.id)
    if (!day.variants.length || !day.variants.some(v => v.id === day.defaultVariantId)) throw new Error('Ogni giorno deve avere una variante predefinita.')
    for (const variant of day.variants) {
      unique(variant.id)
      if (!variant.name.trim()) throw new Error('Inserisci il nome di ogni variante.')
      for (const meal of variant.meals) {
        unique(meal.id)
        if (!meal.name.trim()) throw new Error('Inserisci il nome di ogni pasto.')
        for (const portion of meal.portions) {
          unique(portion.id)
          if (!Number.isFinite(portion.grams) || portion.grams <= 0 || portion.grams > 10000) throw new Error('Le porzioni devono essere maggiori di 0 e non oltre 10.000 g.')
          validateNutrients(portion.foodSnapshot.per100g)
        }
      }
    }
  }
  if (diet.status === 'assigned' && !diet.days.some(day => day.variants.some(v => v.meals.some(m => m.portions.length)))) throw new Error('Aggiungi almeno un alimento prima di assegnare il piano.')
}

export function validateNutrients(n: Nutrients) {
  if (['kcal', 'protein', 'carbs', 'fat'].some(key => !Number.isFinite(n[key as keyof Nutrients]) || n[key as keyof Nutrients] < 0)) throw new Error('I valori nutrizionali devono essere numeri non negativi.')
  if (n.kcal > 1000 || n.protein + n.carbs + n.fat > 100.5) throw new Error('Controlla i valori nutrizionali per 100 g.')
}

export function isLocalDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
}

export function sampleDiet(foods: Food[]) {
  const diet = createDiet()
  diet.name = 'Settimana di esempio'
  diet.notes = 'Esempio dimostrativo di compilazione, da personalizzare. Non è una dieta consigliata.'
  const portions = [['Fiocchi di avena', 40], ['Yogurt greco bianco 0%', 150], ['Mirtilli', 80], ['Mela', 150], ['Pasta di semola', 80], ['Pomodori', 150], ['Olio extravergine di oliva', 10], ['Mandorle', 20], ['Petto di pollo', 150], ['Zucchine', 200], ['Pane integrale', 60]] as const
  const perMeal = [[0, 1, 2], [3], [4, 5, 6], [7], [8, 9, 10]]
  diet.days[0].variants[0].meals.forEach((meal, i) => {
    meal.portions = perMeal[i].flatMap(index => {
      const [name, grams] = portions[index]
      const food = foods.find(f => f.name === name)
      return food ? [createPortion(food, grams)] : []
    })
  })
  return diet
}
