import { id, isLocalDate, now, today } from './diet'
import type { Diet, DietDay, FoodCategory, ID, LocalDate, ShoppingList } from './models'

export interface ShoppingItem { foodId: ID; name: string; preparation: string; category: FoodCategory; grams: number }

export function shoppingDays(diet: Diet, from: LocalDate, to: LocalDate): { date: LocalDate; day: DietDay }[] {
  if (!isLocalDate(from) || !isLocalDate(to) || from > to) throw new Error('Intervallo di giorni non valido.')
  if (from < diet.startsOn || (diet.endsOn && to > diet.endsOn)) throw new Error('L’intervallo deve rientrare nelle date del piano.')
  const cursor = new Date(`${from}T12:00:00Z`)
  const end = new Date(`${to}T12:00:00Z`)
  if ((end.getTime() - cursor.getTime()) / 86400000 > 365) throw new Error('Seleziona al massimo 366 giorni.')
  const days: { date: LocalDate; day: DietDay }[] = []
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10)
    const weekday = (cursor.getUTCDay() + 6) % 7
    const day = diet.days.find(day => day.weekday === weekday)
    if (!day) throw new Error('Giorno del piano mancante.')
    days.push({ date, day })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

/** Inclusive calendar range; repeats the weekly plan and counts ONE alternative per date. */
export function generateShoppingList(diet: Diet, from: LocalDate, to: LocalDate, variantByDate: Record<LocalDate, ID> = {}): ShoppingItem[] {
  const aggregated = new Map<ID, ShoppingItem>()
  for (const { date, day } of shoppingDays(diet, from, to)) {
    const chosen = variantByDate[date] ?? day.defaultVariantId
    const variant = day.variants.find(variant => variant.id === chosen)
    if (!variant) throw new Error(`Variante non disponibile per ${date}.`)
    for (const portion of variant.meals.flatMap(meal => meal.portions)) {
      const existing = aggregated.get(portion.foodId)
      aggregated.set(portion.foodId, { foodId: portion.foodId, name: portion.foodSnapshot.name, category: portion.foodSnapshot.category, preparation: portion.foodSnapshot.preparation, grams: (existing?.grams ?? 0) + portion.grams })
    }
  }
  return [...aggregated.values()].sort((a, b) => a.category.localeCompare(b.category, 'it') || a.name.localeCompare(b.name, 'it'))
}

export function defaultShoppingRange(diet: Diet, currentDate = today()) {
  const from = currentDate < diet.startsOn || (diet.endsOn && currentDate > diet.endsOn) ? diet.startsOn : currentDate
  const end = new Date(`${from}T12:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 6)
  const endDate = end.toISOString().slice(0, 10)
  return { from, to: diet.endsOn && endDate > diet.endsOn ? diet.endsOn : endDate }
}

export function createShoppingRecord(diet: Diet, from: LocalDate, to: LocalDate, variants: Record<LocalDate, ID>, existing?: ShoppingList): ShoppingList {
  const items = generateShoppingList(diet, from, to, variants)
  if (!items.length) throw new Error('Non ci sono alimenti nei giorni selezionati. Compila il piano o scegli un altro intervallo.')
  return {
    id: existing?.id ?? id(), createdAt: existing?.createdAt ?? now(), updatedAt: now(), generationId: id(),
    dietId: diet.id, dietRevision: diet.revision, patientId: diet.patientId, from, to,
    variantByDate: Object.fromEntries(shoppingDays(diet, from, to).map(({ date, day }) => [date, variants[date] ?? day.defaultVariantId])),
    checkedFoodIds: [],
  }
}
