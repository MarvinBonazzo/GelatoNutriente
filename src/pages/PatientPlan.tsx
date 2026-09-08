import { useState } from 'react'
import { ArrowLeft, ClipboardList, ShoppingBasket } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DayCard } from '../components/DayCard'
import { NutrientSummary } from '../components/NutrientSummary'
import { variantNutrients, weekdays } from '../domain/diet'
import { useAppStore } from '../store/app-store'

export function PatientPlan({ preview = false }: { preview?: boolean }) {
  const { draft, patients, diets, selectedPatientId, selectPatient } = useAppStore()
  const [weekday, setWeekday] = useState((new Date().getDay() + 6) % 7)
  const [variantId, setVariantId] = useState('')
  const patient = patients.find(p => p.id === selectedPatientId) ?? patients[0]
  const diet = preview ? draft : diets.find(d => d.id === patient?.assignedDietId && d.status === 'assigned' && d.patientId === patient.id)
  const day = diet?.days.find(d => d.weekday === weekday)
  const variant = day?.variants.find(v => v.id === variantId) ?? day?.variants.find(v => v.id === day.defaultVariantId)
  return <div className="patient-view">
    <Link to="/piani" className="text-link"><ArrowLeft size={17} />Torna ai piani</Link>
    {preview ? <div className="info-banner">Anteprima del piano aperto, incluse le modifiche non ancora salvate.</div> : <div className="info-banner">Vista paziente locale · Usa lo stesso archivio del nutrizionista, in questo browser.</div>}
    {!preview && <label className="patient-selector">Visualizza come paziente<select aria-label="Paziente da visualizzare" value={patient?.id ?? ''} onChange={e => { selectPatient(e.target.value); setVariantId('') }}><option value="" disabled>Seleziona un paziente</option>{patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
    <div className="page-heading"><div><p className="eyebrow">UN GIORNO ALLA VOLTA</p><h1>{preview ? 'Il piano, a colpo d’occhio' : patient ? `Ciao, ${patient.name.split(' ')[0]}` : 'Il tuo piano alimentare'}<span className="heading-dot">.</span></h1><p>{diet?.name ?? 'Qui troverai il piano assegnato dal nutrizionista.'}</p></div></div>
    {!diet || !day || !variant ? <div className="large-empty panel"><ClipboardList size={36} /><h2>Nessun piano assegnato</h2><p>Seleziona un paziente nell’editor e usa “Assegna piano” per renderlo disponibile in questa vista.</p><Link className="button" to="/piani">Vai ai piani</Link></div> : <>
      <div className="patient-plan-actions"><div className="plan-period">Dal {new Date(`${diet.startsOn}T12:00:00`).toLocaleDateString('it-IT')}{diet.endsOn ? ` al ${new Date(`${diet.endsOn}T12:00:00`).toLocaleDateString('it-IT')}` : ' · Schema settimanale'}</div>{!preview && <Link className="button secondary" to="/paziente/spesa"><ShoppingBasket size={17} />Lista della spesa</Link>}</div>
      <div className="week-tabs" role="tablist" aria-label="Giorni della dieta">{weekdays.map((name, i) => <button key={name} role="tab" aria-selected={weekday === i} className={weekday === i ? 'active' : ''} onClick={() => { setWeekday(i); setVariantId('') }}><span>{name}</span></button>)}</div>
      <div className="day-heading"><h2>{weekdays[weekday]}</h2><span>{variant.meals.length} pasti</span></div>
      {day.variants.length > 1 && <label className="variant-selector">Scegli una delle alternative della giornata<select value={variant.id} onChange={e => setVariantId(e.target.value)}>{day.variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>}
      <NutrientSummary nutrients={variantNutrients(variant)} />
      <DayCard day={day} variantId={variant.id} readOnly />
      {diet.notes && <section className="panel patient-notes"><h2>Note del piano</h2><p>{diet.notes}</p></section>}
    </>}
  </div>
}
