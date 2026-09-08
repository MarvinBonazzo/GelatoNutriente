import { useState } from 'react'
import { AlertCircle, ArrowLeft, Check, ChevronDown, ClipboardList, RefreshCw, ShoppingBasket } from 'lucide-react'
import { Link } from 'react-router-dom'
import { weekdays } from '../domain/diet'
import { createShoppingRecord, defaultShoppingRange, generateShoppingList, shoppingDays, type ShoppingItem } from '../domain/shopping'
import type { Diet, ShoppingList } from '../domain/models'
import { format } from '../components/NutrientSummary'
import { useAppStore } from '../store/app-store'

const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const quantityLabel = (grams: number) => grams >= 1000 ? `${format(grams / 1000, 2)} kg` : `${format(grams, 1)} g`

function ShoppingBuilder({ diet, saved }: { diet: Diet; saved?: ShoppingList }) {
  const { saveShoppingList, checkShoppingItem, refresh } = useAppStore()
  const defaultRange = defaultShoppingRange(diet)
  const [from, setFrom] = useState(saved?.from ?? defaultRange.from)
  const [to, setTo] = useState(saved?.to ?? defaultRange.to)
  const [variants, setVariants] = useState<Record<string, string>>(saved?.variantByDate ?? {})
  const [saving, setSaving] = useState(false)
  const [busyFoodIds, setBusyFoodIds] = useState<string[]>([])
  const [error, setError] = useState('')
  let days: ReturnType<typeof shoppingDays> = []
  let rangeError = ''
  try { days = shoppingDays(diet, from, to) }
  catch (error) { rangeError = error instanceof Error ? error.message : 'Controlla l’intervallo selezionato.' }
  const resolvedVariants = Object.fromEntries(days.map(({ date, day }) => [date, day.variants.some(v => v.id === variants[date]) ? variants[date] : day.defaultVariantId]))
  const replacedVariants = days.filter(({ date, day }) => variants[date] && !day.variants.some(v => v.id === variants[date])).length
  const emptyDays = days.filter(({ date, day }) => !day.variants.find(v => v.id === resolvedVariants[date])?.meals.some(m => m.portions.length))
  const stale = !!saved && saved.dietRevision !== diet.revision
  const pendingChanges = !!saved && (from !== saved.from || to !== saved.to || days.some(({ date }) => resolvedVariants[date] !== saved.variantByDate[date]))
  let items: ShoppingItem[] = []
  let listError = ''
  if (saved && !stale) {
    try { items = generateShoppingList(diet, saved.from, saved.to, saved.variantByDate) }
    catch (error) { listError = error instanceof Error ? error.message : 'Lista non disponibile.' }
  }
  const checkedIds = new Set(saved?.checkedFoodIds ?? [])
  const checkedCount = items.filter(item => checkedIds.has(item.foodId)).length
  const groups = [...new Set(items.map(item => item.category))]
  const checkboxesDisabled = saving || stale || pendingChanges || !!listError

  async function generate() {
    setError(''); setSaving(true)
    try { await saveShoppingList(createShoppingRecord(diet, from, to, resolvedVariants, saved)) }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Salvataggio non riuscito. Riprova.'
      setError(message)
      useAppStore.getState().notify(message)
      await refresh().catch(() => {})
    } finally { setSaving(false) }
  }

  async function checkItem(foodId: string, checked: boolean) {
    if (!saved) return
    setError(''); setBusyFoodIds(ids => [...ids, foodId])
    try { await checkShoppingItem(saved.id, saved.generationId, foodId, checked) }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Spunta non salvata. Riprova.'
      setError(message)
      useAppStore.getState().notify(message)
      await refresh().catch(() => {})
    } finally { setBusyFoodIds(ids => ids.filter(id => id !== foodId)) }
  }

  return <div className="shopping-layout">
    <section className="shopping-config panel" aria-label="Configura lista della spesa">
      <header><span className="eyebrow">ORGANIZZA LA SPESA</span><h2>Quali giorni includere?</h2><p>Le quantità si riferiscono al piano salvato.</p></header>
      <div className="form-grid"><label>Dal<input type="date" min={diet.startsOn} max={diet.endsOn} value={from} onChange={e => setFrom(e.target.value)} /></label><label>Al<input type="date" min={from || diet.startsOn} max={diet.endsOn} value={to} onChange={e => setTo(e.target.value)} /></label></div>
      {rangeError ? <p className="error" role="alert">{rangeError}</p> : <>
        <div className="shopping-range-caption">{days.length} {days.length === 1 ? 'giorno incluso' : 'giorni inclusi'} · Una variante per giorno</div>
        <details className="shopping-alternatives" open={days.some(({ day }) => day.variants.length > 1) || undefined}><summary>Giorni e alternative<ChevronDown size={16} /></summary><div className="shopping-days">{days.map(({ date, day }) => <label className="shopping-day" key={date}><span><strong>{weekdays[day.weekday]}</strong><small>{dateLabel(date)}</small></span><select aria-label={`Variante per ${date}`} value={resolvedVariants[date]} onChange={e => setVariants(current => ({ ...current, [date]: e.target.value }))}>{day.variants.map(v => <option key={v.id} value={v.id}>{v.name}{v.id === day.defaultVariantId ? ' · Principale' : ''}</option>)}</select></label>)}</div></details>
        {replacedVariants > 0 && <p className="shopping-warning"><AlertCircle size={17} /><span>{replacedVariants} {replacedVariants === 1 ? 'alternativa non è più disponibile' : 'alternative non sono più disponibili'}. Sono selezionate le varianti principali: controlla le scelte prima di generare.</span></p>}
        {emptyDays.length > 0 && <p className="shopping-warning"><AlertCircle size={17} /><span>{emptyDays.length} {emptyDays.length === 1 ? 'giorno non ha alimenti' : 'giorni non hanno alimenti'} nella variante scelta. La spesa include soltanto i giorni compilati.</span></p>}
      </>}
      <button className="button generate-shopping" disabled={saving || !!rangeError || days.length === emptyDays.length || busyFoodIds.length > 0} onClick={generate}>{saved ? <RefreshCw size={17} /> : <ShoppingBasket size={18} />}{saving ? 'Generazione…' : saved ? 'Rigenera lista' : 'Genera lista'}</button>
      {saved && <p className="shopping-reset-hint">Rigenerare la lista azzera tutte le spunte.</p>}
    </section>
    <div className="shopping-result">
      {error && <p className="error" role="alert">{error}</p>}
      {stale ? <section className="panel large-empty"><RefreshCw size={32} /><h2>Il piano è cambiato</h2><p>Rigenera la lista per usare pasti e quantità aggiornati. Le spunte precedenti verranno azzerate.</p></section> : !saved ? <section className="panel large-empty"><span className="empty-icon"><ShoppingBasket size={31} /></span><h2>Solo quello che serve</h2><p>Scegli i giorni e genera la lista. Gli alimenti ripetuti nei pasti verranno raggruppati con la quantità totale da acquistare.</p></section> : listError ? <section className="panel large-empty"><h2>La lista va aggiornata</h2><p role="alert">{listError}</p><p>Controlla date e varianti, poi rigenera la lista.</p></section> : <>
        {pendingChanges && <div className="info-banner">Hai modificato giorni o alternative. Qui sotto trovi l’ultima lista salvata: rigenerala per applicare le nuove scelte.</div>}
        <section className="shopping-progress panel" aria-label="Avanzamento della spesa"><div><div><span className="eyebrow">DAL {dateLabel(saved.from).toLocaleUpperCase('it')} AL {dateLabel(saved.to).toLocaleUpperCase('it')}</span><h2>{checkedCount === items.length && items.length > 0 ? 'Tutto nel carrello!' : 'La tua lista'}</h2></div><span className="shopping-count"><strong>{checkedCount}</strong> / {items.length}</span></div><progress value={checkedCount} max={Math.max(items.length, 1)} aria-label={`${checkedCount} di ${items.length} alimenti acquistati`} /><p>{items.length - checkedCount} alimenti da acquistare · Spunte salvate automaticamente</p></section>
        <div className="shopping-groups">{groups.map(category => <section className="shopping-group panel" key={category}><header><h3>{category}</h3><span>{items.filter(item => item.category === category).length} alimenti</span></header>{items.filter(item => item.category === category).map(item => <label className={`shopping-item ${checkedIds.has(item.foodId) ? 'checked' : ''}`} key={item.foodId}><input type="checkbox" checked={checkedIds.has(item.foodId)} disabled={checkboxesDisabled || busyFoodIds.includes(item.foodId)} onChange={e => checkItem(item.foodId, e.target.checked)} aria-label={`${item.name}, ${quantityLabel(item.grams)}, acquistato`} /><span className="shopping-checkbox" aria-hidden="true">{checkedIds.has(item.foodId) && <Check size={15} />}</span><span className="shopping-item-name"><strong>{item.name}</strong><small>{item.preparation}</small></span><span className="shopping-quantity">{quantityLabel(item.grams)}</span></label>)}</section>)}</div>
        <p className="shopping-footnote">Quantità riferite alla parte edibile e allo stato indicato. I liquidi sono espressi in grammi.</p>
      </>}
    </div>
  </div>
}

export function Shopping({ patientView = false }: { patientView?: boolean }) {
  const { diets, patients, draft, dirty, shoppingLists, selectedPatientId, selectPatient } = useAppStore()
  const [selectedDietId, setSelectedDietId] = useState('')
  const patient = patients.find(p => p.id === selectedPatientId) ?? patients[0]
  const diet = patientView
    ? diets.find(d => d.id === patient?.assignedDietId && d.status === 'assigned' && d.patientId === patient.id)
    : diets.find(d => d.id === selectedDietId) ?? diets.find(d => d.id === draft.id) ?? diets[0]
  const saved = shoppingLists.filter(list => list.dietId === diet?.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  return <>
    {patientView && <Link className="text-link" to="/paziente"><ArrowLeft size={17} />Torna al tuo piano</Link>}
    <div className="page-heading"><div><p className="eyebrow">DAL PIANO AL CARRELLO</p><h1>La lista della spesa<span className="heading-dot">.</span></h1><p>Ingredienti e quantità, pronti per la tua settimana.</p></div></div>
    <div className="shopping-plan-picker panel">{patientView ? <label>Paziente<select value={patient?.id ?? ''} onChange={e => selectPatient(e.target.value)}><option value="" disabled>Seleziona un paziente</option>{patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label> : <label>Piano alimentare<select value={diet?.id ?? ''} onChange={e => setSelectedDietId(e.target.value)}><option value="" disabled>Seleziona un piano salvato</option>{diets.map(d => <option key={d.id} value={d.id}>{d.name}{d.patientId ? ` · ${patients.find(p => p.id === d.patientId)?.name ?? ''}` : ''}</option>)}</select></label>}<div><span className="badge green">{patientView ? 'Vista paziente locale' : 'Archivio locale'}</span><p>{diet ? patientView ? diet.name : 'La lista usa la versione salvata del piano.' : 'Salva un piano per creare la sua lista.'}</p></div></div>
    {!patientView && dirty && diet?.id === draft.id && <div className="info-banner">Il piano aperto nell’editor ha modifiche non salvate. Salvalo per includerle nella spesa.</div>}
    {!diet ? <section className="large-empty panel"><ClipboardList size={34} /><h2>{patientView ? 'Nessun piano assegnato' : 'Inizia da un piano alimentare'}</h2><p>{patientView ? 'La lista sarà disponibile quando un piano verrà assegnato al paziente selezionato.' : 'Crea e salva un piano con i pasti della settimana. Qui potrai trasformarlo in una lista della spesa.'}</p><Link className="button" to="/piani">Vai ai piani</Link></section> : <ShoppingBuilder key={`${diet.id}-${saved?.generationId ?? 'new'}`} diet={diet} saved={saved} />}
  </>
}
