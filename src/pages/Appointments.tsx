import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Download, Pencil, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '../store/app-store'
import { id, now } from '../domain/diet'
import { appointmentIcs } from '../domain/calendar'
import type { Appointment } from '../domain/models'
import { downloadFile } from '../app/download'
import { PatientSelector } from '../components/PatientSelector'
import { Modal } from '../components/Modal'

function localInput(instant: string) { const d = new Date(instant); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

export function Appointments({ patientView = false }: { patientView?: boolean }) {
  const { appointments, patients, selectedPatientId, saveAppointment, notify } = useAppStore()
  const patient = patients.find(p => p.id === selectedPatientId) ?? patients[0]
  const [params] = useSearchParams()
  const requestedMonth = params.get('mese')
  const [editing, setEditing] = useState<Appointment | 'new' | null>(null)
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const [month, setMonth] = useState(localInput(now()).slice(0, 7))
  const [selectedDate, setSelectedDate] = useState('')
  useEffect(() => { if (requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)) { setMonth(requestedMonth); setSelectedDate('') } }, [requestedMonth])
  const calendarMonth = month || localInput(now()).slice(0, 7)
  const [year, monthNumber] = calendarMonth.split('-').map(Number)
  const firstOffset = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  function changeMonth(offset: number) { const date = new Date(year, monthNumber - 1 + offset, 1, 12); setMonth(localInput(date.toISOString()).slice(0, 7)); setSelectedDate('') }
  const visible = appointments.filter(a => a.patientId === patient?.id && (showPast || (a.status === 'scheduled' && Date.parse(a.startsAt) >= Date.now())) && (!month || localInput(a.startsAt).startsWith(month)) && (!selectedDate || localInput(a.startsAt).startsWith(selectedDate))).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const original = editing && editing !== 'new' ? editing : undefined
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!patient) return; setSaving(true); setError('')
    const f = new FormData(e.currentTarget)
    try {
      const localDate = String(f.get('startsAt')); const instant = new Date(localDate)
      if (localInput(instant.toISOString()) !== localDate) throw new Error('Quest’ora non esiste nel fuso del dispositivo. Scegli un altro orario.')
      const appointment: Appointment = { id: original?.id ?? id(), createdAt: original?.createdAt ?? now(), updatedAt: now(), patientId: patient.id, title: String(f.get('title')).trim(), startsAt: instant.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, durationMinutes: Number(f.get('duration')), reminderMinutesBefore: Number(f.get('reminder')), location: String(f.get('location')), notes: String(f.get('notes')), status: f.get('status') as Appointment['status'] }
      await saveAppointment(appointment); setEditing(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Salvataggio non riuscito.') } finally { setSaving(false) }
  }
  return <>
    {patientView && <Link className="text-link" to="/paziente"><ArrowLeft size={16} />Torna al piano</Link>}
    <div className="page-heading"><div><p className="eyebrow">IL PROSSIMO INCONTRO</p><h1>Appuntamenti<span className="heading-dot">.</span></h1><p>Agenda e promemoria per il percorso nutrizionale.</p></div>{!patientView && <button className="button" disabled={!patient} onClick={() => { setError(''); setEditing('new') }}><Plus size={17} />Nuovo appuntamento</button>}</div>
    <PatientSelector />
    <div className="info-banner">Gli avvisi nell’app funzionano mentre è aperta. Scarica il file calendario e importalo sul dispositivo per impostare l’allarme anche quando l’app è chiusa. Il calendario deve consentire le notifiche.</div>
    <div className="section-tools"><label>Mese<select aria-label="Mese appuntamenti" value={month} onChange={e => { setMonth(e.target.value); setSelectedDate('') }}><option value="">Tutti i mesi</option>{[...new Set([calendarMonth, ...appointments.filter(a => a.patientId === patient?.id).map(a => localInput(a.startsAt).slice(0, 7))])].sort().map(m => <option key={m}>{m}</option>)}</select></label><label className="inline-check"><input type="checkbox" checked={showPast} onChange={e => setShowPast(e.target.checked)} />Mostra anche lo storico</label></div>
    <section className="panel module-panel calendar-panel" aria-label="Calendario appuntamenti"><header><button className="icon-button" aria-label="Mese precedente" onClick={() => changeMonth(-1)}><ChevronLeft /></button><h2>{new Date(year, monthNumber - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</h2><button className="icon-button" aria-label="Mese successivo" onClick={() => changeMonth(1)}><ChevronRight /></button></header><div className="calendar-grid">{['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(name => <strong key={name}>{name}</strong>)}{Array.from({ length: firstOffset }, (_, i) => <span key={`blank-${i}`} />)}{Array.from({ length: daysInMonth }, (_, i) => { const date = `${calendarMonth}-${String(i + 1).padStart(2, '0')}`; const count = appointments.filter(a => a.patientId === patient?.id && a.status === 'scheduled' && localInput(a.startsAt).startsWith(date)).length; return <button className={selectedDate === date ? 'selected' : ''} key={date} aria-label={`${date}, ${count} appuntamenti`} aria-pressed={selectedDate === date} onClick={() => { setMonth(calendarMonth); setSelectedDate(selectedDate === date ? '' : date) }}><span>{i + 1}</span>{count > 0 && <small>{count}</small>}</button> })}</div>{selectedDate && <button className="text-link" onClick={() => setSelectedDate('')}>Mostra tutto il mese</button>}</section>
    {!visible.length ? <div className="large-empty panel"><CalendarDays size={34} /><h2>Nessun appuntamento nel periodo</h2></div> : <div className="appointment-grid">{visible.map(a => <article className="panel appointment-card" key={a.id}><div className="appointment-date"><strong>{new Date(a.startsAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</strong><span>{new Date(a.startsAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span></div><div><h2>{a.title}</h2><p>{a.location || 'Luogo da concordare'} · {a.durationMinutes} min</p><p className="field-hint">Orario del dispositivo: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p><span className="badge">{a.status === 'scheduled' ? 'Programmato' : a.status === 'completed' ? 'Completato' : 'Annullato'}</span>{!patientView && a.notes && <p>{a.notes}</p>}<div className="appointment-actions"><button className="button secondary" onClick={() => { try { downloadFile(appointmentIcs(a), 'Appuntamento-GelatoNutriente.ics', 'text/calendar;charset=utf-8') } catch (e) { notify(e instanceof Error ? e.message : 'Esportazione non riuscita.') } }}><Download size={16} />File calendario</button>{!patientView && <button className="icon-button" aria-label={`Modifica ${a.title}`} onClick={() => { setError(''); setEditing(a) }}><Pencil size={17} /></button>}</div></div></article>)}</div>}
    {editing && <Modal title={original ? 'Modifica appuntamento' : 'Nuovo appuntamento'} onClose={() => setEditing(null)}><form className="form-stack" onSubmit={submit}><label>Titolo<input name="title" required maxLength={120} defaultValue={original?.title ?? 'Controllo nutrizionale'} /></label><label>Data e ora<input type="datetime-local" name="startsAt" required defaultValue={original ? localInput(original.startsAt) : undefined} /></label><p className="field-hint">Fuso: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Nel cambio all’ora solare viene usata la prima occorrenza dell’ora duplicata.</p><div className="form-grid"><label>Durata (minuti)<input name="duration" type="number" min="5" max="1440" required defaultValue={original?.durationMinutes ?? 30} /></label><label>Promemoria<select name="reminder" defaultValue={original?.reminderMinutesBefore ?? 60}>{[[0, 'All’orario'], [15, '15 minuti prima'], [60, '1 ora prima'], [1440, '1 giorno prima'], [10080, '1 settimana prima']].map(([v, title]) => <option value={v} key={v}>{title}</option>)}</select></label></div><label>Luogo<input name="location" maxLength={300} defaultValue={original?.location} /></label><label>Stato<select name="status" defaultValue={original?.status ?? 'scheduled'}><option value="scheduled">Programmato</option><option value="completed">Completato</option><option value="cancelled">Annullato</option></select></label><label>Note riservate dello studio<textarea name="notes" rows={2} maxLength={2000} defaultValue={original?.notes} /></label>{error && <p role="alert" className="error">{error}</p>}<button className="button" disabled={saving}>Salva appuntamento</button></form></Modal>}
  </>
}
