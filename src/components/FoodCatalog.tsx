import { useState } from 'react'
import { Plus, Search, Wheat } from 'lucide-react'
import type { Food } from '../domain/models'
import { useAppStore } from '../store/app-store'
import { categories, FoodForm } from './FoodForm'
import { Modal } from './Modal'
import { format } from './NutrientSummary'

export function FoodCatalog({ onAdd, mealName, full = false }: { onAdd?: (food: Food) => void; mealName?: string; full?: boolean }) {
  const foods = useAppStore(s => s.foods)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [creating, setCreating] = useState(false)
  const normalized = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('it')
  const results = foods.filter(food => (!category || food.category === category) && normalized(food.name).includes(normalized(search.trim())))
  return <section className={`catalog panel ${full ? 'catalog-full' : ''}`} id="food-catalog" aria-label="Catalogo alimenti">
    <div className="catalog-title"><div><h2>Alimenti</h2><p>{full ? `${foods.length} alimenti nel tuo catalogo` : mealName ? `Aggiungi a: ${mealName}` : 'Seleziona un pasto per aggiungere'}</p></div><button className="icon-button" aria-label="Crea nuovo alimento" onClick={() => setCreating(true)}><Plus size={20} /></button></div>
    <label className="search-box"><Search size={18} /><input aria-label="Cerca un alimento" placeholder="Cerca un alimento…" value={search} onChange={e => setSearch(e.target.value)} /></label>
    <select aria-label="Filtra per categoria" value={category} onChange={e => setCategory(e.target.value)}><option value="">Tutte le categorie</option>{categories.map(category => <option key={category}>{category}</option>)}</select>
    <div className="catalog-label"><span>{results.length} ALIMENTI</span><span>PER 100 G</span></div>
    <div className="food-results">{results.map(food => <div key={food.id} className="food-item">
      {full && <span className="food-icon"><Wheat size={19} /></span>}
      <div className="food-description"><strong>{food.name}{food.isCustom && <span className="custom-dot" title="Alimento personale" />}</strong><span>{food.preparation}</span>{full && <small>P {format(food.per100g.protein, 1)} g · C {format(food.per100g.carbs, 1)} g · G {format(food.per100g.fat, 1)} g</small>}</div>
      <span className="food-energy">{format(food.per100g.kcal)}<small>kcal</small></span>
      {onAdd && <button className="food-add" disabled={!mealName} onClick={() => onAdd(food)} aria-label={`Aggiungi ${food.name} a ${mealName ?? 'un pasto'}`}><Plus size={17} /></button>}
    </div>)}{!results.length && <p className="empty-panel">Nessun alimento trovato. Puoi aggiungerlo con il pulsante +.</p>}</div>
    <p className="catalog-note">Il catalogo iniziale contiene valori indicativi. Per un piano reale, verifica i dati con etichette o tabelle validate.</p>
    {creating && <Modal title="Nuovo alimento" onClose={() => setCreating(false)}><FoodForm onSaved={() => setCreating(false)} onCancel={() => setCreating(false)} /></Modal>}
  </section>
}
