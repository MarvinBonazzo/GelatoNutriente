import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAppStore } from '../store/app-store'
import { id, now, today } from '../domain/diet'
import { AnthropometryPanel } from '../components/AnthropometryPanel'
import { PatientForm } from '../components/PatientForm'
import { bodyMassIndex, measurementsWithBaseline } from '../domain/anthropometry'
import { recentMeasurements } from '../domain/clinical'
import type { Measurement } from '../domain/models'
import { MeasurementChart } from '../components/MeasurementChart'
import { PatientSelector } from '../components/PatientSelector'
import { Modal } from '../components/Modal'
import { format } from '../components/NutrientSummary'

const metrics = { weightKg: 'Peso (kg)', bmi: 'BMI (kg/m²)', waist: 'Vita (cm)', hips: 'Fianchi (cm)', chest: 'Torace (cm)', arm: 'Braccio (cm)', thigh: 'Coscia (cm)' }
type Metric = keyof typeof metrics

export function Measurements({ patientView = false }: { patientView?: boolean }) {
  const { patients, selectedPatientId, measurements, saveMeasurement, removeMeasurement, notify } = useAppStore()
  const patient = patients.find(p => p.id === selectedPatientId) ?? patients[0]
  const [editingProfile, setEditingProfile] = useState(false)
  const [metric, setMetric] = useState<Metric>('weightKg')
  const [editing, setEditing] = useState<Measurement | 'new' | null>(null)
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const all = patient ? measurementsWithBaseline(patient, measurements) : []
  const visible = (patientView ? recentMeasurements(all) : all).sort((a, b) => b.date.localeCompare(a.date))
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!patient) return
    setError(''); setSaving(true)
    const form = new FormData(e.currentTarget)
    const value = (key: string) => form.get(key) === '' ? undefined : Number(form.get(key))
    const previous = editing && editing !== 'new' ? editing : undefined
    const m: Measurement = { id: previous?.id ?? id(), createdAt: previous?.createdAt ?? now(), updatedAt: now(), patientId: patient.id, date: String(form.get('date')), weightKg: value('weightKg'), heightCm: value('heightCm'), circumferencesCm: { waist: value('waist'), hips: value('hips'), chest: value('chest'), arm: value('arm'), thigh: value('thigh') }, notes: String(form.get('notes')).trim(), enteredBy: previous?.enteredBy ?? (patientView ? 'patient' : 'nutritionist') }
    try { await saveMeasurement(m); setEditing(null) } catch (e) { setError(e instanceof Error ? e.message : 'Salvataggio non riuscito.') } finally { setSaving(false) }
  }
  const original = editing && editing !== 'new' ? editing : undefined
  return <>
    {patientView && <Link className="text-link" to="/paziente"><ArrowLeft size={16} />Torna al piano</Link>}
    <div className="page-heading"><div><p className="eyebrow">I CAMBIAMENTI NEL TEMPO</p><h1>Misurazioni<span className="heading-dot">.</span></h1><p>{patientView ? 'Il tuo andamento negli ultimi due anni.' : 'Peso, circonferenze e storico dei pazienti.'}</p></div><button className="button" disabled={!patient} onClick={() => { setError(''); setEditing('new') }}><Plus size={17} />Nuova misura</button></div>
    <PatientSelector />
    {!patient ? <div className="large-empty panel"><h2>Aggiungi prima un paziente</h2><Link className="button" to="/pazienti">Apri pazienti</Link></div> : <>
      <section className="panel module-panel">{!patientView && <button className="button secondary" onClick={() => setEditingProfile(true)}><Pencil size={16} />Prima visita e obiettivo</button>}<AnthropometryPanel patient={patient} measurements={measurements} /></section>
      <section className="panel module-panel"><div className="module-heading"><h2>{patient.name}</h2><label>Metrica<select value={metric} onChange={e => setMetric(e.target.value as Metric)}>{Object.entries(metrics).map(([value, title]) => <option value={value} key={value}>{title}</option>)}</select></label></div><MeasurementChart measurements={visible} metric={metric} />{patient.targetWeight && <p className="field-hint">Obiettivo concordato: {format(patient.targetWeight.kg, 1)} kg</p>}</section>
      <section className="panel module-panel"><h2>Storico</h2>{!visible.length ? <p className="empty-panel">Nessuna misurazione nel periodo.</p> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Data</th><th>{metrics[metric]}</th><th>Note</th><th>Azioni</th></tr></thead><tbody>{visible.map(m => { const isBaseline = m.id === `baseline-${patient.id}`; const value = metric === 'bmi' ? m.weightKg && m.heightCm ? bodyMassIndex(m.weightKg, m.heightCm) : undefined : metric === 'weightKg' ? m.weightKg : m.circumferencesCm[metric]; return <tr key={m.id}><td>{new Date(`${m.date}T12:00:00`).toLocaleDateString('it-IT')}</td><td>{value === undefined ? 'Non rilevato' : format(value, 1)}</td><td>{m.notes || '—'}</td><td>{isBaseline ? (!patientView ? <button className="text-link" onClick={() => setEditingProfile(true)}>Modifica prima visita</button> : <span>Prima visita</span>) : <><button className="icon-button" aria-label={`Modifica misura del ${m.date}`} onClick={() => { setError(''); setEditing(m) }}><Pencil size={16} /></button><button className="icon-button" aria-label={`Elimina misura del ${m.date}`} onClick={async () => { if (!window.confirm('Eliminare questa misurazione?')) return; try { await removeMeasurement(m.id) } catch { notify('Eliminazione non riuscita.') } }}><Trash2 size={16} /></button></>}</td></tr> })}</tbody></table></div>}</section>
    </>}
    {editingProfile && patient && <Modal title="Prima visita e valutazione" onClose={() => setEditingProfile(false)}><PatientForm patient={patient} onSaved={() => setEditingProfile(false)} onCancel={() => setEditingProfile(false)} /></Modal>}
    {editing && <Modal title={original ? 'Modifica misurazione' : 'Nuova misurazione'} onClose={() => setEditing(null)}><form className="form-stack" onSubmit={submit}><label>Data<input name="date" type="date" defaultValue={original?.date ?? today()} required max={today()} /></label><label>Altezza alla rilevazione (cm)<input name="heightCm" type="number" min="50" max="250" step="0.1" defaultValue={original ? original.heightCm : patient?.heightCm ?? patient?.initialAssessment?.heightCm} /></label><p className="field-hint">Conferma l’altezza riferita a questa data: viene conservata per calcolare il BMI senza riscrivere lo storico.</p><div className="form-grid">{Object.entries(metrics).filter(([key]) => key !== 'bmi').map(([key, title]) => <label key={key}>{title}<input name={key} type="number" min="0.1" max="1000" step="0.1" defaultValue={key === 'weightKg' ? original?.weightKg : original?.circumferencesCm[key as Exclude<Metric, 'weightKg' | 'bmi'>]} /></label>)}</div><p className="field-hint">Compila almeno una misura. Lascia vuoti i valori non rilevati.</p><label>Note<textarea name="notes" rows={2} maxLength={2000} defaultValue={original?.notes} /></label>{error && <p className="error" role="alert">{error}</p>}<button className="button" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva misurazione'}</button></form></Modal>}
  </>
}
