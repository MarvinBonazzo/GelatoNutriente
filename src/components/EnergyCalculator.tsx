import type { Patient } from '../domain/models'
import { compareEnergyMethods, energyMethods, estimateEnergyNeeds, energyReferenceSource, goalStrategies, type EnergyCalculationMethod, type GoalStrategy } from '../domain/clinical'
import { useAppStore } from '../store/app-store'
import { defaultMacroTargets, macroGramTargets, macroProfileIsModified, macroProfiles, type MacroProfileId } from '../domain/macros'
import { format } from './NutrientSummary'

type EnergyProfile = NonNullable<Patient['energyProfile']>
type EnergyPatient = Pick<Patient, 'initialAssessment' | 'anthropometryContext' | 'birthDate' | 'heightCm' | 'sexForFormula' | 'energyProfile'>

export function EnergyCalculator({ value, onChange, patientId }: { patientId?: string; value: EnergyPatient; onChange: (value: EnergyPatient) => void }) {
  const measurements = useAppStore(s => s.measurements)
  const energy = value.energyProfile
  const method = energy?.calculationMethod ?? 'mifflin'
  const goal = energy?.goal
  const goalStrategy = goal && goal !== 'maintain' ? energy?.goalStrategy ?? 'percentage' : 'none'
  const goalDefinition = goalStrategies.find(item => item.id === goalStrategy)!
  const macroTargets = energy?.macroTargets
  const macroTotal = macroTargets ? macroTargets.carbsPercent + macroTargets.proteinPercent + macroTargets.fatPercent : 0
  const macroValid = !!macroTargets && [macroTargets.carbsPercent, macroTargets.proteinPercent, macroTargets.fatPercent].every(item => Number.isFinite(item) && item >= 0 && item <= 100) && Math.abs(macroTotal - 100) < .01
  const macroProfile = energy?.macroProfile ?? (macroTargets ? 'custom' : '')
  const macroDefinition = macroProfiles.find(item => item.id === macroProfile)
  const macroModified = macroProfileIsModified(energy?.macroProfile, macroTargets)
  const patient = { ...value, id: patientId ?? 'preview' }
  const relevantMeasurements = patientId ? measurements.filter(item => item.patientId === patientId) : []
  let estimate: ReturnType<typeof estimateEnergyNeeds> | undefined
  let error = ''
  try { estimate = estimateEnergyNeeds(patient, relevantMeasurements) }
  catch (caught) { error = caught instanceof Error ? caught.message : 'Completa i dati richiesti.' }
  const comparisons = compareEnergyMethods(patient, relevantMeasurements)
  const setEnergy = (patch: Partial<EnergyProfile>) => onChange({ ...value, energyProfile: { ...energy, ...patch } })
  const setNumber = (key: 'bodyFatPercent' | 'measuredRestingKcal' | 'kcalPerKg' | 'adjustmentKcal' | 'targetKcal' | 'goalPercent' | 'goalFixedKcal' | 'goalWeeklyKg', raw: string) => setEnergy({ [key]: raw === '' ? undefined : Number(raw) })
  const macroGrams = macroTargets && macroValid && (energy?.targetKcal ?? estimate?.targetKcal) ? macroGramTargets(energy?.targetKcal ?? estimate!.targetKcal, macroTargets) : undefined
  const chooseMacroProfile = (raw: string) => {
    if (!raw) return setEnergy({ macroProfile: undefined, macroTargets: undefined })
    const profile = raw as MacroProfileId
    if (profile === 'custom') return setEnergy({ macroProfile: profile, macroTargets: macroTargets ?? { ...defaultMacroTargets } })
    const definition = macroProfiles.find(item => item.id === profile)!
    setEnergy({ macroProfile: profile, macroTargets: { ...definition.targets } })
  }
  const chooseGoal = (raw: string) => {
    if (!raw) return setEnergy({ goal: undefined })
    const next = raw as EnergyProfile['goal']
    setEnergy({ goal: next, goalStrategy: next === 'maintain' ? 'none' : energy?.goalStrategy && energy.goalStrategy !== 'none' ? energy.goalStrategy : 'percentage' })
  }

  return <details className="form-section" open><summary>Fabbisogno calorico e obiettivi giornalieri</summary><div className="form-stack">
    <div className="form-grid">
      <label>Metodo di calcolo<select value={method} onChange={event => setEnergy({ calculationMethod: event.target.value as EnergyCalculationMethod })}>{energyMethods.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label>Livello di attività fisica<select disabled={method === 'kcal-per-kg'} value={energy?.activityLevel ?? ''} onChange={event => setEnergy({ activityLevel: event.target.value ? event.target.value as EnergyProfile['activityLevel'] : undefined })}><option value="">Da indicare</option><option value="low">Basso / sedentario · PAL 1,4</option><option value="moderate">Moderato · PAL 1,6</option><option value="active">Attivo · PAL 1,8</option><option value="very-active">Molto attivo · PAL 2,0</option></select></label>
      <label>Obiettivo del percorso<select value={goal ?? ''} onChange={event => chooseGoal(event.target.value)}><option value="">Da indicare</option><option value="lose">Dimagrimento</option><option value="maintain">Mantenimento</option><option value="gain">Aumento del peso</option></select></label>
      {goal && goal !== 'maintain' && <label>Algoritmo per l’obiettivo<select value={goalStrategy} onChange={event => setEnergy({ goalStrategy: event.target.value as GoalStrategy })}>{goalStrategies.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><small>{goalDefinition.description}</small></label>}
      {goal && goal !== 'maintain' && goalStrategy === 'percentage' && <label>Variazione del mantenimento (%)<input type="number" min="1" max="40" step="1" value={energy?.goalPercent ?? (goal === 'lose' ? 15 : 10)} onChange={event => setNumber('goalPercent', event.target.value)} /></label>}
      {goal && goal !== 'maintain' && goalStrategy === 'fixed-kcal' && <label>Scarto giornaliero (kcal)<input type="number" min="50" max="2000" step="50" value={energy?.goalFixedKcal ?? (goal === 'lose' ? 500 : 250)} onChange={event => setNumber('goalFixedKcal', event.target.value)} /></label>}
      {goal && goal !== 'maintain' && goalStrategy === 'weekly-rate' && <label>Ritmo teorico (kg/settimana)<input type="number" min="0.05" max="2" step="0.05" value={energy?.goalWeeklyKg ?? (goal === 'lose' ? .5 : .25)} onChange={event => setNumber('goalWeeklyKg', event.target.value)} /><small>Conversione statica orientativa, non previsione del peso.</small></label>}
      {(method === 'cunningham' || method === 'katch-mcardle') && <label>Massa grassa misurata (%)<input type="number" min="0.1" max="75" step="0.1" value={energy?.bodyFatPercent ?? ''} onChange={event => setNumber('bodyFatPercent', event.target.value)} /></label>}
      {method === 'indirect-calorimetry' && <label>Dispendio a riposo misurato (kcal)<input type="number" min="200" max="10000" step="1" value={energy?.measuredRestingKcal ?? ''} onChange={event => setNumber('measuredRestingKcal', event.target.value)} /></label>}
      {method === 'kcal-per-kg' && <label>Coefficiente scelto (kcal/kg)<input type="number" min="5" max="100" step="0.1" value={energy?.kcalPerKg ?? ''} onChange={event => setNumber('kcalPerKg', event.target.value)} /></label>}
      <label>Correzione professionale ulteriore (kcal/giorno)<input type="number" min="-3000" max="3000" step="50" value={energy?.adjustmentKcal ?? ''} placeholder="0" onChange={event => setNumber('adjustmentKcal', event.target.value)} /><small>Applicata dopo l’algoritmo dell’obiettivo; per esempio −100 oppure +150.</small></label>
    </div>

    {estimate ? <div className="energy-result">
      <div className="energy-result-heading"><div><span>Metodo selezionato</span><strong>{estimate.methodLabel}</strong></div><a href={estimate.source} target="_blank" rel="noreferrer">Fonte</a></div>
      <code>{estimate.formula}</code>
      <div className="goal-calculation"><div><span>Algoritmo dell’obiettivo</span><strong>{estimate.goalStrategyLabel}</strong></div><code>{estimate.goalFormula}</code><a href={estimate.goalStrategySource} target="_blank" rel="noreferrer">Fonte e limiti</a></div>
      <div className="energy-estimate">
        {estimate.restingKcal !== undefined && <div><span>Dispendio a riposo</span><strong>{format(estimate.restingKcal)} kcal</strong></div>}
        <div><span>{method === 'kcal-per-kg' ? 'Stima diretta giornaliera' : 'Mantenimento con PAL'}</span><strong>{format(estimate.dailyKcal)} kcal</strong></div>
        <div><span>Dopo l’obiettivo ({estimate.goalAdjustmentKcal >= 0 ? '+' : ''}{format(estimate.goalAdjustmentKcal)} kcal)</span><strong>{format(estimate.goalAdjustedKcal)} kcal</strong></div>
        <div><span>Risultato calcolato finale</span><strong>{format(estimate.calculatedTargetKcal)} kcal</strong></div>
        <small>Dati usati: {format(estimate.weightKg, 1)} kg{estimate.heightCm ? ` · ${format(estimate.heightCm, 1)} cm` : ''} · {estimate.age} anni{estimate.activityFactor ? ` · PAL ${format(estimate.activityFactor, 1)}` : ''}{estimate.leanMassKg ? ` · massa magra ${format(estimate.leanMassKg, 1)} kg` : ''}.{estimate.olderThanOriginalSample ? ' Età oltre il campione originario Mifflin: interpretare con particolare cautela.' : ''}</small>
      </div>
      {estimate.targetBelowResting && <p className="shopping-warning">Il risultato calcolato è inferiore al dispendio a riposo stimato: richiede una verifica professionale specifica.</p>}
      {estimate.manualOverride && <p className="info-banner">L’obiettivo manuale di {format(estimate.targetKcal)} kcal ha priorità: i calcoli sopra cambiano, ma il piano userà il valore manuale finché non lo rimuovi.</p>}
      <button type="button" className="button secondary" onClick={() => setEnergy({ targetKcal: Math.round(estimate!.calculatedTargetKcal) })}>Usa {format(estimate.calculatedTargetKcal)} kcal come obiettivo modificabile</button>
    </div> : <p className="info-banner">Il metodo selezionato non è ancora calcolabile: {error}</p>}

    <label>Obiettivo energetico finale modificabile (kcal/giorno)<input type="number" min="1" max="10000" step="1" value={energy?.targetKcal ?? ''} placeholder={estimate ? String(Math.round(estimate.calculatedTargetKcal)) : ''} onChange={event => setNumber('targetKcal', event.target.value)} /><small>{energy?.targetKcal !== undefined ? 'Valore manuale attivo: è quello usato nel piano e nel generatore.' : 'Vuoto: il piano usa il risultato calcolato, quando disponibile.'}</small></label>
    {energy?.targetKcal !== undefined && <button type="button" className="text-link energy-reset" onClick={() => setEnergy({ targetKcal: undefined })}>Rimuovi il valore manuale e usa il calcolo</button>}

    <details className="energy-comparison"><summary>Confronta tutti i metodi ({energyMethods.length})</summary><div className="energy-method-list">{comparisons.map(item => <article key={item.method.id} className={item.method.id === method ? 'selected' : ''}><div><strong>{item.method.label}</strong><span>{item.method.description}</span></div>{item.estimate ? <div className="energy-method-value"><strong>{format(item.estimate.calculatedTargetKcal)} kcal obiettivo</strong><small>mantenimento {format(item.estimate.dailyKcal)} · {item.estimate.restingKcal !== undefined ? `riposo ${format(item.estimate.restingKcal)} · ` : ''}{item.estimate.formula}</small></div> : <small className="energy-method-missing">{item.error}</small>}<div className="energy-method-actions"><a href={item.estimate?.source ?? item.method.source} target="_blank" rel="noreferrer">Fonte</a><button type="button" className="text-link" onClick={() => setEnergy({ calculationMethod: item.method.id })}>{item.method.id === method ? 'Selezionato' : 'Usa metodo'}</button></div></article>)}</div></details>

    <p className="field-hint">Le equazioni sono stime per adulti e possono divergere. L’obiettivo modifica ora il mantenimento con l’algoritmo scelto; la correzione e l’override manuale restano decisioni del professionista. La regola kg/settimana è statica e non incorpora l’adattamento metabolico: per una simulazione dinamica esterna consulta il <a href="https://www.niddk.nih.gov/bwp" target="_blank" rel="noreferrer">NIH Body Weight Planner</a>. PAL: <a href={energyReferenceSource} target="_blank" rel="noreferrer">riferimenti EFSA</a>.</p>
    <fieldset><legend>Ripartizione energetica obiettivo dei macronutrienti</legend>
      <label>Profilo di partenza<select value={macroProfile} onChange={event => chooseMacroProfile(event.target.value)}><option value="">Nessuna ripartizione</option>{macroProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.label}</option>)}<option value="custom">Personalizzata</option></select></label>
      {macroTargets && <><div className="macro-target-grid"><label>Carboidrati (%)<input type="number" min="0" max="100" step="1" value={macroTargets.carbsPercent} onChange={event => setEnergy({ macroTargets: { ...macroTargets, carbsPercent: Number(event.target.value) } })} /></label><label>Proteine (%)<input type="number" min="0" max="100" step="1" value={macroTargets.proteinPercent} onChange={event => setEnergy({ macroTargets: { ...macroTargets, proteinPercent: Number(event.target.value) } })} /></label><label>Grassi (%)<input type="number" min="0" max="100" step="1" value={macroTargets.fatPercent} onChange={event => setEnergy({ macroTargets: { ...macroTargets, fatPercent: Number(event.target.value) } })} /></label></div><p className={macroValid ? 'macro-total valid' : 'macro-total invalid'}>Totale: {format(macroTotal, 1)}% {macroValid ? '✓' : '· ogni valore deve essere 0–100 e il totale 100%'}{macroModified ? ' · modificato dal professionista' : ''}</p>
        {macroGrams && <p className="macro-grams">Con {format(energy?.targetKcal ?? estimate!.targetKcal)} kcal: circa <strong>{format(macroGrams.carbs, 1)} g carboidrati</strong>, <strong>{format(macroGrams.protein, 1)} g proteine</strong> e <strong>{format(macroGrams.fat, 1)} g grassi</strong>.</p>}
        <p className="field-hint">{macroDefinition ? <>Perché questo profilo: {macroDefinition.rationale} <a href={macroDefinition.source} target="_blank" rel="noreferrer">Riferimento</a>.</> : 'Profilo interamente definito dal professionista.'} Le percentuali sono un obiettivo operativo e restano sempre modificabili.</p>
      </>}
    </fieldset>
  </div></details>
}
