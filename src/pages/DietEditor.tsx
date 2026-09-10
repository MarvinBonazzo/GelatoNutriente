import { useState } from 'react'
import { ArrowDown, Check, CheckCheck, Copy, Eye, FilePlus2, Plus, Save, Sparkles, Trash2, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cloneVariant, createDiet, createPortion, id, sampleDiet, variantNutrients, weekdays } from '../domain/diet'
import type { DayVariant, Food, Meal } from '../domain/models'
import { useAppStore } from '../store/app-store'
import { DayCard } from '../components/DayCard'
import { FoodCatalog } from '../components/FoodCatalog'
import { NutrientSummary, format } from '../components/NutrientSummary'
import { Modal } from '../components/Modal'
import { PatientForm } from '../components/PatientForm'
import { DietActions } from '../components/DietActions'
import { DietGenerator } from '../components/DietGenerator'

export function DietEditor() {
  const { draft, dirty, diets, patients, foods, editDraft, setDraft, saveDraft } = useAppStore()
  const [weekday, setWeekday] = useState(0)
  const [variantId, setVariantId] = useState('')
  const [mealId, setMealId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<'patient' | 'meal' | null>(null)
  const [mealName, setMealName] = useState('')
  const day = draft.days.find(d => d.weekday === weekday)!
  const variant = day.variants.find(v => v.id === variantId) ?? day.variants.find(v => v.id === day.defaultVariantId) ?? day.variants[0]
  const activeMeal = variant.meals.find(m => m.id === mealId) ?? variant.meals[0]
  const activePatient = patients.find(p => p.id === draft.patientId)
  const filledDays = draft.days.filter(day => day.variants.some(v => v.meals.some(m => m.portions.length))).length
  function updateVariant(change: (variant: DayVariant) => void) {
    editDraft(d => change(d.days.find(d => d.id === day.id)!.variants.find(v => v.id === variant.id)!))
  }
  function changeMeal(meal: Meal) { updateVariant(v => { v.meals = v.meals.map(m => m.id === meal.id ? meal : m) }) }
  function replaceDraft(next: typeof draft, changed = false) {
    if (dirty && !window.confirm('Le modifiche del piano non sono salvate. Vuoi scartarle e aprire un altro piano?')) return
    setDraft(next, changed); setVariantId(''); setWeekday(0); setMealId(''); setError('')
  }
  async function save(assign = false) {
    setError(''); setSaving(true)
    try { await saveDraft(assign ? 'assigned' : undefined) }
    catch (error) { setError(error instanceof Error ? error.message : 'Non è stato possibile salvare. Riprova.') }
    finally { setSaving(false) }
  }
  function addFood(food: Food) {
    if (!activeMeal) return
    updateVariant(v => { v.meals.find(m => m.id === activeMeal.id)!.portions.push(createPortion(food)) })
  }
  function duplicateVariant() {
    const copy = cloneVariant(variant, `Opzione ${day.variants.length + 1}`)
    editDraft(d => { d.days.find(d => d.id === day.id)!.variants.push(copy) })
    setVariantId(copy.id); setMealId('')
  }
  function copyDay(targetWeekday: number) {
    const destination = draft.days.find(d => d.weekday === targetWeekday)!
    if (destination.variants.some(v => v.meals.some(m => m.portions.length)) && !window.confirm(`Sostituire i pasti e le varianti di ${weekdays[targetWeekday]} con quelli di ${weekdays[weekday]}?`)) return
    editDraft(d => {
      const target = d.days.find(d => d.id === destination.id)!
      const defaultIndex = day.variants.findIndex(v => v.id === day.defaultVariantId)
      target.variants = day.variants.map(v => cloneVariant(v, v.name))
      target.defaultVariantId = target.variants[defaultIndex].id
    })
    useAppStore.getState().notify(`Giornata copiata in ${weekdays[targetWeekday]}. Salva il piano per conservarla.`)
  }
  return <>
    <div className="page-heading"><div><p className="eyebrow">IL TUO SPAZIO DI LAVORO</p><h1>Piani alimentari<span className="heading-dot">.</span></h1><p>Organizza pasti, porzioni e alternative per ogni giorno.</p></div><button className="button secondary" onClick={() => replaceDraft(createDiet())}><FilePlus2 size={17} />Nuovo piano</button></div>
    <div className="plan-toolbar"><label className="plan-picker"><span>Piano aperto</span><select aria-label="Apri piano salvato" value={diets.some(d => d.id === draft.id) ? draft.id : ''} onChange={e => { const diet = diets.find(d => d.id === e.target.value); if (diet) replaceDraft(diet) }}><option value="" disabled>Nuovo piano · non salvato</option>{diets.map(diet => <option key={diet.id} value={diet.id}>{diet.name}</option>)}</select></label><span className={`save-status ${dirty ? 'unsaved' : ''}`}><i />{dirty ? 'Modifiche da salvare' : draft.revision ? 'Salvato nel browser' : 'Bozza da compilare'}</span><Link className="text-link preview-link" to="/anteprima"><Eye size={17} />Anteprima paziente</Link></div>
    <div className="editor-extra-actions"><DietActions diet={draft} /><DietGenerator /></div><section className="plan-details panel" aria-label="Informazioni del piano">
      <div className="plan-name-row"><input className="plan-name" aria-label="Nome del piano" maxLength={120} value={draft.name} onChange={e => editDraft(d => { d.name = e.target.value })} /><span className={`badge ${draft.status === 'assigned' ? 'green' : ''}`}>{draft.status === 'assigned' ? 'Assegnato' : 'Bozza'}</span></div>
      <div className="plan-fields"><label>Paziente<div className="patient-picker"><select aria-label="Paziente del piano" value={draft.patientId ?? ''} onChange={e => editDraft(d => { d.patientId = e.target.value || undefined; d.status = 'draft' })}><option value="">Seleziona un paziente</option>{patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="icon-button" title="Nuovo paziente" aria-label="Nuovo paziente" onClick={() => setModal('patient')}><UserPlus size={19} /></button></div></label><label>Data di inizio<input type="date" aria-label="Data di inizio" value={draft.startsOn} onChange={e => editDraft(d => { d.startsOn = e.target.value })} /></label><label>Data di fine <small>facoltativa</small><input type="date" aria-label="Data di fine" min={draft.startsOn} value={draft.endsOn ?? ''} onChange={e => editDraft(d => { d.endsOn = e.target.value || undefined })} /></label></div>
    </section>
    {!diets.length && <div className="example-strip"><span><Sparkles size={17} />Il primo piano? Puoi compilarlo da zero o esplorare un esempio.</span><button onClick={() => replaceDraft(sampleDiet(foods), true)}>Carica esempio <span aria-hidden>↗</span></button></div>}
    <div className="week-caption"><h2>La settimana</h2><span>{filledDays} di 7 giorni compilati</span></div>
    <div className="week-tabs" role="tablist" aria-label="Giorni della settimana">{draft.days.map(d => {
      const selectedVariant = d.variants.find(v => v.id === d.defaultVariantId)!
      const kcal = variantNutrients(selectedVariant).kcal
      return <button role="tab" aria-selected={d.weekday === weekday} className={d.weekday === weekday ? 'active' : ''} key={d.id} onClick={() => { setWeekday(d.weekday); setVariantId(''); setMealId('') }}><span>{weekdays[d.weekday]}</span><small>{kcal ? `${format(kcal)} kcal` : 'Da compilare'}</small></button>
    })}</div>
    <div className="editor-layout"><div className="editor-main">
      <div className="day-heading"><div><h2>{weekdays[weekday]}</h2><span>{variant.meals.length} pasti · {day.variants.length} {day.variants.length === 1 ? 'variante' : 'varianti'}</span></div><label className="copy-day"><Copy size={15} /><select aria-label="Copia giornata in" value="" onChange={e => copyDay(Number(e.target.value))}><option value="" disabled>Copia giornata in…</option>{weekdays.map((name, i) => i !== weekday && <option value={i} key={name}>{name}</option>)}</select></label></div>
      <div className="variant-bar"><div className="variant-tabs" aria-label="Varianti del giorno">{day.variants.map(v => <button key={v.id} aria-pressed={variant.id === v.id} className={variant.id === v.id ? 'active' : ''} onClick={() => { setVariantId(v.id); setMealId('') }}>{v.id === day.defaultVariantId && <Check size={13} />}{v.name}</button>)}<button className="variant-add" onClick={duplicateVariant}><Plus size={15} />Variante</button></div></div>
      <div className="variant-meta"><label><span className="sr-only">Nome variante</span><input aria-label="Nome variante" maxLength={60} value={variant.name} onChange={e => updateVariant(v => { v.name = e.target.value })} /></label>{variant.id !== day.defaultVariantId ? <button className="text-link" onClick={() => editDraft(d => { d.days.find(d => d.id === day.id)!.defaultVariantId = variant.id })}>Usa come principale</button> : <span><CheckCheck size={14} />Principale</span>}{day.variants.length > 1 && <button className="icon-button" aria-label="Elimina variante" onClick={() => { if (!window.confirm(`Eliminare la variante “${variant.name}” e i suoi pasti?`)) return; editDraft(d => { const current = d.days.find(d => d.id === day.id)!; current.variants = current.variants.filter(v => v.id !== variant.id); if (current.defaultVariantId === variant.id) current.defaultVariantId = current.variants[0].id }); setVariantId(''); setMealId('') }}><Trash2 size={15} /></button>}</div>
      <NutrientSummary nutrients={variantNutrients(variant)} targetKcal={activePatient?.energyProfile?.targetKcal} macroTargets={activePatient?.energyProfile?.macroTargets} />
      <DayCard day={day} variantId={variant.id} activeMealId={activeMeal?.id} onChangeMeal={changeMeal} onSelectMeal={id => { setMealId(id); if (window.matchMedia('(max-width: 1100px)').matches) document.getElementById('food-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} onRemoveMeal={id => { const meal = variant.meals.find(m => m.id === id)!; if (meal.portions.length && !window.confirm(`Eliminare ${meal.name} e i suoi alimenti?`)) return; updateVariant(v => { v.meals = v.meals.filter(m => m.id !== id) }) }} />
      <button className="add-meal" onClick={() => { setMealName(''); setModal('meal') }}><Plus size={17} />Aggiungi un pasto</button>
      <label className="plan-notes">Note per il paziente<textarea rows={3} maxLength={5000} value={draft.notes} placeholder="Indicazioni, sostituzioni e consigli da accompagnare al piano…" onChange={e => editDraft(d => { d.notes = e.target.value })} /></label>
    </div><aside className="editor-sidebar"><FoodCatalog onAdd={addFood} mealName={activeMeal?.name} /><div className="helper-note"><span className="helper-icon"><ArrowDown size={16} /></span><div><strong>Ogni porzione conta</strong><p>Aggiungi un alimento, poi modifica i grammi nel pasto. I totali si aggiornano subito.</p></div></div></aside></div>
    {error && <p className="error" role="alert">{error}</p>}
    <footer className="save-bar"><div><span className="save-bar-title">{draft.name || 'Piano senza nome'}</span><span>{filledDays}/7 giorni · {draft.patientId ? patients.find(p => p.id === draft.patientId)?.name : 'Nessun paziente selezionato'}</span></div><div className="save-actions"><button className="button secondary" disabled={saving} onClick={() => save()}><Save size={17} />{saving ? 'Salvataggio…' : 'Salva piano'}</button><button className="button" disabled={saving || !draft.patientId} title={!draft.patientId ? 'Seleziona prima un paziente' : undefined} onClick={() => save(true)}><Check size={18} />Assegna piano</button></div></footer>
    {modal === 'patient' && <Modal title="Nuovo paziente" onClose={() => setModal(null)}><PatientForm onSaved={patient => { editDraft(d => { d.patientId = patient.id; d.status = 'draft' }); setModal(null) }} onCancel={() => setModal(null)} /></Modal>}
    {modal === 'meal' && <Modal title="Aggiungi un pasto" onClose={() => setModal(null)}><form className="form-stack" onSubmit={e => { e.preventDefault(); if (!mealName.trim()) return; const meal = { id: id(), name: mealName.trim(), portions: [] }; updateVariant(v => { v.meals.push(meal) }); setMealId(meal.id); setModal(null) }}><label>Nome del pasto<input autoFocus required maxLength={60} value={mealName} onChange={e => setMealName(e.target.value)} placeholder="Es. Spuntino serale" /></label><button className="button">Aggiungi pasto</button></form></Modal>}
  </>
}
