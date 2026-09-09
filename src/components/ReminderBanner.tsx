import { useEffect, useState } from 'react'
import { Bell, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../store/app-store'
import { dueAppointments } from '../domain/calendar'
import { now } from '../domain/diet'

export function ReminderBanner({ patientView }: { patientView: boolean }) {
  const { appointments, patients, selectedPatientId, saveAppointment, notify, selectPatient } = useAppStore()
  const [time, setTime] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setTime(Date.now()), 30000); return () => clearInterval(timer) }, [])
  const patient = patients.find(p => p.id === selectedPatientId) ?? patients[0]
  const due = dueAppointments(appointments, time).filter(a => !patientView || a.patientId === patient?.id)
  if (!due.length) return null
  return <section className="reminder-banner" aria-label="Promemoria appuntamenti">{due.map(a => <div key={a.id}><Bell size={18} /><Link onClick={() => selectPatient(a.patientId)} to={`${patientView ? '/paziente/appuntamenti' : '/appuntamenti'}?mese=${new Date(a.startsAt).getFullYear()}-${String(new Date(a.startsAt).getMonth() + 1).padStart(2, '0')}`}>{a.title} · {new Date(a.startsAt).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{!patientView ? ` · ${patients.find(p => p.id === a.patientId)?.name ?? ''}` : ''}</Link><button className="icon-button" aria-label={`Segna promemoria ${a.title} come letto`} onClick={async () => { try { await saveAppointment({ ...a, reminderAcknowledgedAt: now() }) } catch { notify('Promemoria non aggiornato.') } }}><Check size={18} /></button></div>)}</section>
}
