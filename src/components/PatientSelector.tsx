import { useAppStore } from '../store/app-store'

export function PatientSelector() {
  const { patients, selectedPatientId, selectPatient } = useAppStore()
  const selected = patients.find(p => p.id === selectedPatientId) ?? patients[0]
  return <label className="patient-selector">Paziente<select value={selected?.id ?? ''} onChange={e => selectPatient(e.target.value)}><option value="" disabled>Seleziona un paziente</option>{patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
}
