import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAppStore } from '../store/app-store'
import { generateDietDraft } from '../domain/generator'
import { Modal } from './Modal'

export function DietGenerator() {
  const { draft, foods, patients, setDraft } = useAppStore()
  const [open, setOpen] = useState(false); const [kcal, setKcal] = useState(''); const [mode, setMode] = useState<'fixed' | 'multiple'>('fixed'); const [reviewed, setReviewed] = useState(false); const [error, setError] = useState('')
  const patient = patients.find(p => p.id === draft.patientId)
  return <><button className="button secondary" onClick={() => { setError(''); setReviewed(false); setOpen(true) }}><Sparkles size={17} />Compila settimana</button>{open && <Modal title="Compila una bozza settimanale" onClose={() => setOpen(false)}><form className="form-stack" onSubmit={e => {
    e.preventDefault(); setError('')
    if (!reviewed) return
    if (draft.days.some(d => d.variants.some(v => v.meals.some(m => m.portions.length))) && !window.confirm('Sostituire tutti i pasti e le varianti della settimana aperta?')) return
    try { setDraft(generateDietDraft(draft, foods, patient, Number(kcal), mode), true); setOpen(false) } catch (e) { setError(e instanceof Error ? e.message : 'Generazione non riuscita.') }
  }}><p>Compila sette giorni da modelli di pasti e adatta le porzioni alle kcal indicate. Il risultato è una bozza da controllare, senza assegnazione automatica.</p><label>Energia giornaliera definita dal nutrizionista (kcal)<input autoFocus required type="number" min="1" max="10000" value={kcal} onChange={e => setKcal(e.target.value)} /></label><label>Tipo di piano<select value={mode} onChange={e => setMode(e.target.value as typeof mode)}><option value="fixed">Menu giornaliero fisso</option><option value="multiple">Scelta multipla · 2 varianti per giorno</option></select></label>
    {patient?.intake && <div className="info-banner">Paziente: {patient.name}. Esclusioni selezionate: {patient.intake.excludedFoodIds.length}.<br />Allergie/intolleranze dichiarate: {patient.intake.allergies || 'Non indicate'}.<br />Altre esclusioni: {patient.intake.exclusions || 'Non indicate'}.</div>}
    <p className="field-hint">Il compilatore rispetta gli alimenti esclusi selezionati e favorisce i preferiti compatibili con i modelli. Non interpreta allergie o testo libero. Il catalogo iniziale contiene valori dimostrativi: verifica dati, porzioni, varietà ed equilibrio nutrizionale prima dell’uso reale.</p>
    <label className="inline-check"><input type="checkbox" required checked={reviewed} onChange={e => setReviewed(e.target.checked)} />Ho controllato allergie, note e alimenti esclusi del paziente.</label>{error && <p className="error" role="alert">{error}</p>}<button className="button">Genera bozza dei 7 giorni</button>
  </form></Modal>}</>
}
