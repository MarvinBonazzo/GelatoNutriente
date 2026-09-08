import { useState, type FormEvent } from 'react'
import { id, now } from '../domain/diet'
import type { Food, FoodCategory, Nutrients } from '../domain/models'
import { useAppStore } from '../store/app-store'

export const categories: FoodCategory[] = ['Cereali', 'Proteine', 'Latticini', 'Legumi', 'Verdura', 'Frutta', 'Grassi e frutta secca', 'Altro']

export function FoodForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const saveFood = useAppStore(s => s.saveFood)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSaving(true)
    const data = new FormData(event.currentTarget)
    const food: Food = {
      id: id(), createdAt: now(), updatedAt: now(), name: String(data.get('name')).trim(), category: data.get('category') as FoodCategory,
      preparation: String(data.get('preparation')).trim(), source: String(data.get('source')).trim() || 'Inserimento manuale', isCustom: true,
      per100g: Object.fromEntries(['kcal', 'protein', 'carbs', 'fat'].map(key => [key, Number(data.get(key))])) as unknown as Nutrients,
    }
    try { await saveFood(food); onSaved() }
    catch (error) { setError(error instanceof Error ? error.message : 'Salvataggio non riuscito.') }
    finally { setSaving(false) }
  }
  return <form className="form-stack" onSubmit={submit}>
    <label>Nome alimento<input autoFocus name="name" required maxLength={120} placeholder="Es. Yogurt bianco" /></label>
    <div className="form-grid"><label>Categoria<select name="category">{categories.map(c => <option key={c}>{c}</option>)}</select></label><label>Stato / preparazione<input name="preparation" required maxLength={150} placeholder="Es. crudo, senza buccia" /></label></div>
    <fieldset><legend>Valori per 100 g</legend><div className="form-grid">{[['kcal', 'Energia (kcal)'], ['protein', 'Proteine (g)'], ['carbs', 'Carboidrati (g)'], ['fat', 'Grassi (g)']].map(([key, label]) => <label key={key}>{label}<input name={key} type="number" required min="0" max={key === 'kcal' ? 1000 : 100} step="0.1" placeholder="0" /></label>)}</div></fieldset>
    <label>Fonte<input name="source" maxLength={300} placeholder="Es. etichetta del prodotto, marca e data" /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <footer className="form-actions"><button type="button" className="button secondary" onClick={onCancel}>Annulla</button><button className="button" disabled={saving}>{saving ? 'Salvataggio…' : 'Aggiungi alimento'}</button></footer>
  </form>
}
