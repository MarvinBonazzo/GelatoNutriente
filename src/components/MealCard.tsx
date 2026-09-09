import { useState } from 'react'
import { Coffee, Moon, Plus, Sun, Trash2, Utensils } from 'lucide-react'
import { createPortion, mealNutrients, nutrientsForPortion } from '../domain/diet'
import type { Meal } from '../domain/models'
import { useAppStore } from '../store/app-store'
import { format } from './NutrientSummary'
import { Modal } from './Modal'

export function MealCard({ meal, active = false, readOnly = false, onSelect, onChange, onRemove }: {
  meal: Meal; active?: boolean; readOnly?: boolean
  onSelect?: () => void; onChange?: (meal: Meal) => void; onRemove?: () => void
}) {
  const foods = useAppStore(s => s.foods)
  const [editingId, setEditingId] = useState('')
  const [foodId, setFoodId] = useState('')
  const [grams, setGrams] = useState('100')
  const edited = meal.portions.find(p => p.id === editingId)
  const Icon = meal.name === 'Colazione' ? Coffee : meal.name === 'Cena' ? Moon : meal.name === 'Pranzo' ? Utensils : Sun
  return <section className={`meal-card ${active ? 'selected' : ''}`} aria-label={meal.name}>
    <header className="meal-heading">
      <div className="meal-title"><span className="meal-icon"><Icon size={19} /></span><h3>{meal.name}</h3><span className="meal-count">{meal.portions.length} alimenti</span></div>
      <div className="meal-tools"><span>{format(mealNutrients(meal).kcal)} <small>kcal</small></span>{!readOnly && <button className="icon-button muted" onClick={onRemove} aria-label={`Elimina pasto ${meal.name}`}><Trash2 size={16} /></button>}</div>
    </header>
    {meal.portions.map(portion => <div className="portion-block" key={portion.id}><div className="portion-row">
      <div className="portion-name"><strong>{portion.foodSnapshot.name}</strong><span>{portion.foodSnapshot.preparation}</span></div>
      {readOnly ? <span className="read-grams">{format(portion.grams, 1)} g</span> : <label className="grams"><input type="number" min="0.1" max="10000" step="0.1" value={portion.grams || ''} aria-label={`Grammi di ${portion.foodSnapshot.name}`} onChange={e => onChange?.({ ...meal, portions: meal.portions.map(p => p.id === portion.id ? { ...p, grams: Number(e.target.value) } : p) })} /><span>g</span></label>}
      <span className="portion-kcal">{format(nutrientsForPortion(portion).kcal)} <small>kcal</small></span>
      {!readOnly && <button className="icon-button remove-portion" aria-label={`Rimuovi ${portion.foodSnapshot.name}`} onClick={() => onChange?.({ ...meal, portions: meal.portions.filter(p => p.id !== portion.id) })}><Trash2 size={15} /></button>}
    </div>
      {(portion.alternatives ?? []).map(alternative => <div className="ingredient-alternative" key={alternative.id}><span>oppure <strong>{alternative.foodSnapshot.name}</strong> · {format(alternative.grams, 1)} g<small>{alternative.foodSnapshot.preparation}</small></span>{!readOnly && <button className="icon-button" aria-label={`Rimuovi alternativa ${alternative.foodSnapshot.name}`} onClick={() => onChange?.({ ...meal, portions: meal.portions.map(p => p.id === portion.id ? { ...p, alternatives: p.alternatives?.filter(a => a.id !== alternative.id) } : p) })}><Trash2 size={14} /></button>}</div>)}
      {!readOnly && <button className="text-link ingredient-alternative-button" onClick={() => { setEditingId(portion.id); setFoodId(''); setGrams(String(portion.grams)) }}><Plus size={13} />Alternativa ingrediente</button>}
    </div>)}
    {!readOnly && <button className={`add-food ${active ? 'active' : ''}`} onClick={onSelect}><Plus size={17} />{active ? 'Scegli un alimento dal catalogo' : 'Aggiungi alimento'}</button>}
    {readOnly && !meal.portions.length && <p className="meal-empty">Nessun alimento inserito.</p>}
    {readOnly && meal.portions.some(p => p.alternatives?.length) && <p className="field-hint meal-empty">I totali mostrano gli alimenti principali. Le alternative si scelgono per data nella lista della spesa.</p>}
    {edited && <Modal title={`Alternativa a ${edited.foodSnapshot.name}`} onClose={() => setEditingId('')}><form className="form-stack" onSubmit={e => { e.preventDefault(); const food = foods.find(f => f.id === foodId); if (!food || Number(grams) <= 0 || Number(grams) > 10000) return; onChange?.({ ...meal, portions: meal.portions.map(p => p.id === edited.id ? { ...p, alternatives: [...(p.alternatives ?? []), createPortion(food, Number(grams))] } : p) }); setEditingId('') }}><label>Alimento alternativo<select required value={foodId} onChange={e => setFoodId(e.target.value)}><option value="">Seleziona alimento</option>{foods.map(f => <option key={f.id} value={f.id}>{f.name} · {f.preparation}</option>)}</select></label><label>Porzione alternativa (g)<input type="number" required min="0.1" max="10000" step="0.1" value={grams} onChange={e => setGrams(e.target.value)} /></label><p className="field-hint">La quantità è definita dal nutrizionista. Un alimento alternativo non viene considerato automaticamente equivalente dal punto di vista nutrizionale.</p><button className="button">Aggiungi alternativa</button></form></Modal>}
  </section>
}
