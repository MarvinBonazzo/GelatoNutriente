import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAppStore } from '../store/app-store'
import { generateDietDraft } from '../domain/generator'
import { resolveEnergyTarget } from '../domain/clinical'
import { defaultMacroTargets, macroGramTargets, macroProfileIsModified, macroProfiles, type MacroProfileId, type MacroTargets } from '../domain/macros'
import { macroEnergyPercentages, variantNutrients } from '../domain/diet'
import { format } from './NutrientSummary'
import { Modal } from './Modal'

export function DietGenerator() {
  const { draft, foods, patients, measurements, setDraft, notify } = useAppStore()
  const [open, setOpen] = useState(false)
  const [kcal, setKcal] = useState('')
  const [mode, setMode] = useState<'fixed' | 'multiple'>('fixed')
  const [reviewed, setReviewed] = useState(false)
  const [error, setError] = useState('')
  const [macroProfile, setMacroProfile] = useState<MacroProfileId>('general')
  const [macros, setMacros] = useState<MacroTargets>({ ...defaultMacroTargets })
  const patient = patients.find(item => item.id === draft.patientId)
  let energyTarget: ReturnType<typeof resolveEnergyTarget> | undefined
  try { if (patient) energyTarget = resolveEnergyTarget(patient, measurements.filter(item => item.patientId === patient.id)) } catch { /* The patient form explains missing inputs. */ }
  const suggestedKcal = energyTarget?.targetKcal
  const macroTotal = macros.carbsPercent + macros.proteinPercent + macros.fatPercent
  const macroValid = [macros.carbsPercent, macros.proteinPercent, macros.fatPercent].every(item => Number.isFinite(item) && item >= 0 && item <= 100) && Math.abs(macroTotal - 100) < .01
  const targetGrams = Number(kcal) > 0 && macroValid ? macroGramTargets(Number(kcal), macros) : undefined
  const activeMacroDefinition = macroProfiles.find(item => item.id === macroProfile)
  const savedProfileModified = macroProfileIsModified(macroProfile, macros)
  const structuredPreferences = patient?.intake?.preferredFoodIds.length ?? 0
  const structuredExclusions = patient?.intake?.excludedFoodIds.length ?? 0
  const activeMedications = patient?.medications?.filter(item => item.active).map(item => item.activeIngredient) ?? []
  const reviewItems = patient ? [
    patient.goals && `Obiettivi concordati: ${patient.goals}`,
    patient.intake?.preferences && `Preferenze descritte: ${patient.intake.preferences}`,
    patient.intake?.allergies && `Allergie/intolleranze dichiarate: ${patient.intake.allergies}`,
    patient.intake?.exclusions && `Esclusioni in testo libero: ${patient.intake.exclusions}`,
    patient.intake?.habits && `Giornata alimentare abituale: ${patient.intake.habits}`,
    patient.intake?.mealsAndSchedule && `Pasti e orari: ${patient.intake.mealsAndSchedule}`,
    patient.intake?.workAndActivity && `Lavoro e attività: ${patient.intake.workAndActivity}`,
    patient.intake?.cookingAndBudget && `Cucina e budget: ${patient.intake.cookingAndBudget}`,
    patient.intake?.hydration && `Idratazione e bevande: ${patient.intake.hydration}`,
    patient.intake?.sleepAndStress && `Sonno e stress: ${patient.intake.sleepAndStress}`,
    patient.intake?.conditions && `Condizioni cliniche: ${patient.intake.conditions}`,
    activeMedications.length && `Farmaci attivi: ${activeMedications.join(', ')}`,
    patient.intake?.digestion && `Digestione/alvo: ${patient.intake.digestion}`,
    patient.intake?.supplements && `Integratori: ${patient.intake.supplements}`,
    patient.intake?.alcoholAndSmoking && `Alcol e fumo: ${patient.intake.alcoholAndSmoking}`,
    patient.intake?.dietHistory && `Storia dietetica: ${patient.intake.dietHistory}`,
    patient.notes && `Note professionali: ${patient.notes}`,
  ].filter(Boolean) as string[] : []

  function openGenerator() {
    const savedMacros = patient?.energyProfile?.macroTargets
    setMacros(savedMacros ? { ...savedMacros } : { ...defaultMacroTargets })
    setMacroProfile(patient?.energyProfile?.macroProfile ?? (savedMacros ? 'custom' : 'general'))
    setKcal(suggestedKcal ? String(Math.round(suggestedKcal)) : '')
    setReviewed(false); setError(''); setOpen(true)
  }

  function chooseProfile(value: MacroProfileId) {
    setMacroProfile(value)
    if (value === 'custom') return
    const definition = macroProfiles.find(item => item.id === value)
    if (definition) setMacros({ ...definition.targets })
  }

  return <>
    <button className="button secondary" onClick={openGenerator}><Sparkles size={17} />Compila settimana</button>
    {open && <Modal title="Compila la settimana dal profilo paziente" onClose={() => setOpen(false)}><form className="form-stack" onSubmit={event => {
      event.preventDefault(); setError('')
      if (!patient) return setError('Seleziona prima un paziente nel piano: serve per applicare kcal, macro, preferenze ed esclusioni.')
      if (!reviewed) return
      if (draft.days.some(day => day.variants.some(variant => variant.meals.some(meal => meal.portions.length))) && !window.confirm('Sostituire tutti i pasti e le varianti della settimana aperta?')) return
      try {
        const generated = generateDietDraft(draft, foods, patient, Number(kcal), mode, macros)
        const nutrients = variantNutrients(generated.days[0].variants[0])
        const percentages = macroEnergyPercentages(nutrients)
        setDraft(generated, true); setOpen(false)
        notify(`Bozza personalizzata creata: ${format(nutrients.kcal)} kcal · ${format(percentages.carbs)}% carbo · ${format(percentages.protein)}% proteine · ${format(percentages.fat)}% grassi. Da revisionare.`)
      } catch (caught) { setError(caught instanceof Error ? caught.message : 'Generazione non riuscita.') }
    }}>
      <p>Seleziona il paziente nel piano e apri questo strumento: kcal, percentuali macro e scelte strutturate vengono caricate automaticamente. Il risultato è sempre una bozza non assegnata.</p>
      {!patient ? <p className="error" role="alert">Nessun paziente selezionato. Chiudi questa finestra e scegline uno nel piano.</p> : <div className="patient-generator-summary">
        <strong>{patient.name}</strong>
        <span>{suggestedKcal ? `${format(suggestedKcal)} kcal dal ${energyTarget?.manualOverride ? 'valore modificato dal nutrizionista' : `metodo ${energyTarget?.methodLabel}`}` : 'Kcal non ancora calcolabili: puoi inserirle qui dopo la valutazione.'}</span>
        <span>{structuredPreferences} preferenze compatibili e {structuredExclusions} esclusioni selezionate applicabili automaticamente.</span>
      </div>}

      <div className="generator-why"><strong>Perché il generatore lavora così</strong><p>Le kcal stabiliscono l’energia totale; le percentuali vengono convertite in grammi con i fattori 4 kcal/g per carboidrati e proteine e 9 kcal/g per i grassi. Le porzioni vengono poi ottimizzate insieme per avvicinarsi a entrambi gli obiettivi, mantenendo cinque pasti e quantità pratiche da misurare. I limiti di partenza tengono conto delle <a href="https://sapermangiare.an.crea.gov.it/493/le-giuste-porzioni.html" target="_blank" rel="noreferrer">porzioni di riferimento CREA</a>, ma la bozza va sempre adattata al paziente.</p><p>Preferenze ed esclusioni selezionate sono identificatori certi e vengono applicate. Il testo clinico viene mostrato per la revisione, ma non trasformato automaticamente in una prescrizione.</p></div>

      <label>Energia giornaliera definita dal nutrizionista (kcal)<input autoFocus required type="number" min="1" max="10000" value={kcal} onChange={event => setKcal(event.target.value)} /></label>
      <label>Profilo di ripartizione<select value={macroProfile} onChange={event => chooseProfile(event.target.value as MacroProfileId)}>{macroProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.label}</option>)}<option value="custom">Personalizzata per questa bozza</option></select></label>
      <div className="macro-target-grid"><label>Carboidrati (%)<input type="number" min="0" max="100" step="1" value={macros.carbsPercent} onChange={event => { setMacroProfile('custom'); setMacros({ ...macros, carbsPercent: Number(event.target.value) }) }} /></label><label>Proteine (%)<input type="number" min="0" max="100" step="1" value={macros.proteinPercent} onChange={event => { setMacroProfile('custom'); setMacros({ ...macros, proteinPercent: Number(event.target.value) }) }} /></label><label>Grassi (%)<input type="number" min="0" max="100" step="1" value={macros.fatPercent} onChange={event => { setMacroProfile('custom'); setMacros({ ...macros, fatPercent: Number(event.target.value) }) }} /></label></div>
      <p className={macroValid ? 'macro-total valid' : 'macro-total invalid'}>Totale: {format(macroTotal, 1)}% {macroValid ? '✓' : '· ogni valore deve essere 0–100 e il totale 100%'}{savedProfileModified ? ' · profilo modificato dal nutrizionista' : ''}</p>
      {targetGrams && <p className="macro-grams">Obiettivo matematico: circa {format(targetGrams.carbs, 1)} g carboidrati · {format(targetGrams.protein, 1)} g proteine · {format(targetGrams.fat, 1)} g grassi.</p>}
      <p className="field-hint">{activeMacroDefinition ? <>{activeMacroDefinition.rationale} <a href={activeMacroDefinition.source} target="_blank" rel="noreferrer">Riferimento</a>.</> : 'Ripartizione modificata dal nutrizionista per questa bozza.'} I profili sono punti di partenza, non diagnosi o prescrizioni universali.</p>
      <label>Tipo di piano<select value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="fixed">Menu giornaliero fisso</option><option value="multiple">Scelta multipla · 2 varianti per giorno</option></select></label>

      {patient && <details className="generator-review" open><summary>Informazioni del paziente da controllare ({reviewItems.length})</summary>{reviewItems.length ? <ul>{reviewItems.map(item => <li key={item}>{item}</li>)}</ul> : <p>Nessuna nota clinica o testuale aggiuntiva registrata.</p>}</details>}
      <p className="field-hint">Il compilatore non interpreta automaticamente allergie, patologie, farmaci o testo libero e non verifica micronutrienti, interazioni o adeguatezza clinica. Controlla alimenti, quantità, preparazioni, varietà e tollerabilità prima dell’assegnazione.</p>
      <label className="inline-check"><input type="checkbox" required checked={reviewed} onChange={event => setReviewed(event.target.checked)} />Ho controllato tutte le informazioni del paziente e approvo kcal, macro ed esclusioni per creare la bozza.</label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button" disabled={!patient || !macroValid}>Genera bozza personalizzata dei 7 giorni</button>
    </form></Modal>}
  </>
}
