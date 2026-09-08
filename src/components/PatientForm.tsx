import { useState, type FormEvent } from 'react'
import { id, now } from '../domain/diet'
import type { Patient } from '../domain/models'
import { useAppStore } from '../store/app-store'

export function PatientForm({ patient, onSaved, onCancel }: { patient?: Patient; onSaved: (patient: Patient) => void; onCancel: () => void }) {
  const [name, setName] = useState(patient?.name ?? '')
  const [goals, setGoals] = useState(patient?.goals ?? '')
  const [notes, setNotes] = useState(patient?.notes ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const savePatient = useAppStore(s => s.savePatient)
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    const value: Patient = { ...patient, id: patient?.id ?? id(), createdAt: patient?.createdAt ?? now(), updatedAt: now(), name: name.trim(), goals: goals.trim(), notes: notes.trim() }
    try { await savePatient(value); onSaved(value) }
    catch (error) { setError(error instanceof Error ? error.message : 'Salvataggio non riuscito.') }
    finally { setSaving(false) }
  }
  return <form className="form-stack" onSubmit={submit}>
    <label>Nome e cognome<input autoFocus required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Es. Maria Rossi" /></label>
    <label>Obiettivi<textarea maxLength={2000} rows={2} value={goals} onChange={e => setGoals(e.target.value)} placeholder="Gli obiettivi concordati con il paziente" /></label>
    <label>Note personali<textarea maxLength={5000} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Preferenze e altre informazioni utili" /></label>
    <p className="field-hint">L’anagrafica rimane in questo browser.</p>
    {error && <p role="alert" className="error">{error}</p>}
    <footer className="form-actions"><button type="button" className="button secondary" onClick={onCancel}>Annulla</button><button className="button" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva paziente'}</button></footer>
  </form>
}
