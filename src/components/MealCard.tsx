import { Coffee, Moon, Plus, Sun, Trash2, Utensils } from 'lucide-react'
import { mealNutrients, nutrientsForPortion } from '../domain/diet'
import type { Meal } from '../domain/models'
import { format } from './NutrientSummary'

export function MealCard({ meal, active = false, readOnly = false, onSelect, onChange, onRemove }: {
  meal: Meal; active?: boolean; readOnly?: boolean
  onSelect?: () => void; onChange?: (meal: Meal) => void; onRemove?: () => void
}) {
  const Icon = meal.name === 'Colazione' ? Coffee : meal.name === 'Cena' ? Moon : meal.name === 'Pranzo' ? Utensils : Sun
  return <section className={`meal-card ${active ? 'selected' : ''}`} aria-label={meal.name}>
    <header className="meal-heading">
      <div className="meal-title"><span className="meal-icon"><Icon size={19} /></span><h3>{meal.name}</h3><span className="meal-count">{meal.portions.length} alimenti</span></div>
      <div className="meal-tools"><span>{format(mealNutrients(meal).kcal)} <small>kcal</small></span>{!readOnly && <button className="icon-button muted" onClick={onRemove} aria-label={`Elimina pasto ${meal.name}`}><Trash2 size={16} /></button>}</div>
    </header>
    {meal.portions.map(portion => <div className="portion-row" key={portion.id}>
      <div className="portion-name"><strong>{portion.foodSnapshot.name}</strong><span>{portion.foodSnapshot.preparation}</span></div>
      {readOnly ? <span className="read-grams">{format(portion.grams, 1)} g</span> : <label className="grams"><input type="number" min="0.1" max="10000" step="0.1" value={portion.grams || ''} aria-label={`Grammi di ${portion.foodSnapshot.name}`} onChange={e => onChange?.({ ...meal, portions: meal.portions.map(p => p.id === portion.id ? { ...p, grams: Number(e.target.value) } : p) })} /><span>g</span></label>}
      <span className="portion-kcal">{format(nutrientsForPortion(portion).kcal)} <small>kcal</small></span>
      {!readOnly && <button className="icon-button remove-portion" aria-label={`Rimuovi ${portion.foodSnapshot.name}`} onClick={() => onChange?.({ ...meal, portions: meal.portions.filter(p => p.id !== portion.id) })}><Trash2 size={15} /></button>}
    </div>)}
    {!readOnly && <button className={`add-food ${active ? 'active' : ''}`} onClick={onSelect}><Plus size={17} />{active ? 'Scegli un alimento dal catalogo' : 'Aggiungi alimento'}</button>}
    {readOnly && !meal.portions.length && <p className="meal-empty">Nessun alimento inserito.</p>}
  </section>
}
