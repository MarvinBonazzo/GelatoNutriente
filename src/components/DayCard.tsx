import { weekdays } from '../domain/diet'
import type { DietDay, Meal } from '../domain/models'
import { MealCard } from './MealCard'

/** Shared by the clinician editor and the patient plan. */
export function DayCard({ day, variantId, activeMealId, readOnly = false, onSelectMeal, onChangeMeal, onRemoveMeal }: {
  day: DietDay; variantId: string; activeMealId?: string; readOnly?: boolean
  onSelectMeal?: (id: string) => void; onChangeMeal?: (meal: Meal) => void; onRemoveMeal?: (id: string) => void
}) {
  const variant = day.variants.find(v => v.id === variantId) ?? day.variants[0]
  return <div className="day-card" aria-label={`Pasti di ${weekdays[day.weekday]}`}>
    {variant.meals.map(meal => <MealCard key={meal.id} meal={meal} readOnly={readOnly} active={activeMealId === meal.id} onSelect={() => onSelectMeal?.(meal.id)} onChange={onChangeMeal} onRemove={() => onRemoveMeal?.(meal.id)} />)}
    {!variant.meals.length && <div className="empty-panel">Questo giorno non ha ancora pasti.</div>}
  </div>
}
