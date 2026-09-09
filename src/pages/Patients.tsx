import { useState } from 'react'
import { ArrowUpRight, Pencil, Plus, Search, Users, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Patient } from '../domain/models'
import { createDiet } from '../domain/diet'
import { useAppStore } from '../store/app-store'
import { format } from '../components/NutrientSummary'
import { bodyMassIndex } from '../domain/anthropometry'
import { Modal } from '../components/Modal'
import { PatientForm } from '../components/PatientForm'

export function Patients() {
  const { patients, diets, draft, dirty, setDraft, studio, foods, notify, selectPatient } = useAppStore()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Patient | 'new' | null>(null)
  const navigate = useNavigate()
  async function questionnaire(patient?: Patient) {
    try { const { buildQuestionnairePdf } = await import('../domain/pdf'); buildQuestionnairePdf(patient, studio, foods, !!patient).save('GelatoNutriente-questionario.pdf') }
    catch { notify('Impossibile generare il PDF. Controlla il logo nelle impostazioni dello studio.') }
  }
  function openPlan(patient: Patient) {
    const existing = diets.find(d => d.id === patient.assignedDietId) ?? diets.find(d => d.patientId === patient.id)
    if (dirty && draft.id !== existing?.id && !window.confirm('Vuoi scartare le modifiche del piano aperto?')) return
    if (draft.id !== existing?.id) setDraft(existing ?? { ...createDiet(), patientId: patient.id }, !existing)
    navigate('/piani')
  }
  const results = patients.filter(p => p.name.toLocaleLowerCase('it').includes(search.toLocaleLowerCase('it')))
  return <>
    <div className="page-heading"><div><p className="eyebrow">LE PERSONE, AL CENTRO</p><h1>I tuoi pazienti<span className="heading-dot">.</span></h1><p>Obiettivi, note e piani in un unico spazio.</p></div><button className="button" onClick={() => setEditing('new')}><Plus size={18} />Nuovo paziente</button></div>
    <button className="button secondary" onClick={() => questionnaire()}><FileText size={17} />Questionario stampabile vuoto</button><div className="section-tools"><label className="search-box"><Search size={18} /><input placeholder="Cerca un paziente…" aria-label="Cerca un paziente" value={search} onChange={e => setSearch(e.target.value)} /></label><span>{patients.length} {patients.length === 1 ? 'paziente' : 'pazienti'}</span></div>
    {!results.length ? <div className="large-empty panel"><span className="empty-icon"><Users size={30} /></span><h2>{patients.length ? 'Nessun risultato' : 'Il primo passo è conoscersi'}</h2><p>{patients.length ? 'Prova a cercare un altro nome.' : 'Aggiungi un paziente per raccogliere i suoi obiettivi e assegnargli un piano alimentare.'}</p>{!patients.length && <button className="button" onClick={() => setEditing('new')}><Plus size={17} />Aggiungi il primo paziente</button>}</div> : <div className="patient-grid">{results.map(patient => <article className="patient-card panel" key={patient.id}><header><span className="avatar">{patient.name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}</span><button className="icon-button" aria-label={`Modifica ${patient.name}`} onClick={() => setEditing(patient)}><Pencil size={17} /></button></header><h2>{patient.name}</h2><span className={`badge ${patient.assignedDietId ? 'green' : ''}`}>{patient.assignedDietId ? 'Piano assegnato' : 'Nessun piano assegnato'}</span><button className="text-link questionnaire-link" onClick={() => questionnaire(patient)}><FileText size={16} />Questionario compilato</button><dl>{patient.initialAssessment && <><dt>Prima visita · {new Date(`${patient.initialAssessment.date}T12:00:00`).toLocaleDateString('it-IT')}</dt><dd>{format(patient.initialAssessment.weightKg, 1)} kg · BMI {format(bodyMassIndex(patient.initialAssessment.weightKg, patient.initialAssessment.heightCm), 2)}</dd></>}<dt>Obiettivi</dt><dd>{patient.goals || 'Non ancora indicati'}</dd><dt>Note</dt><dd>{patient.notes || 'Nessuna nota'}</dd></dl><button className="text-link patient-assessment-link" onClick={() => { selectPatient(patient.id); navigate('/misurazioni') }}>Valutazione e andamento<ArrowUpRight size={17} /></button><button className="text-link" onClick={() => openPlan(patient)}>{diets.some(d => d.patientId === patient.id) ? 'Apri piano alimentare' : 'Crea piano alimentare'}<ArrowUpRight size={17} /></button></article>)}</div>}
    {editing && <Modal title={editing === 'new' ? 'Nuovo paziente' : 'Modifica paziente'} onClose={() => setEditing(null)}><PatientForm patient={editing === 'new' ? undefined : editing} onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} /></Modal>}
  </>
}
