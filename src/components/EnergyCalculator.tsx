import type { Patient } from '../domain/models'
import { compareEnergyMethods, energyMethods, estimateEnergyNeeds, energyReferenceSource, type EnergyCalculationMethod } from '../domain/clinical'
import { useAppStore } from '../store/app-store'
import { defaultMacroTargets, macroGramTargets, macroProfileIsModified, macroProfiles, type MacroProfileId } from '../domain/macros'
import { format } from './NutrientSummary'

type EnergyProfile = NonNullable<Patient['energyProfile']>
type EnergyPatient = Pick<Patient, 'initialAssessment' | 'anthropometryContext' | 'birthDate' | 'heightCm' | 'sexForFormula' | 'energyProfile'>

export function EnergyCalculator({ value, onChange, patientId }: { patientId?: string; value: EnergyPatient; onChange: (value: EnergyPatient) => void }) {
  const measurements = useAppStore(s => s.measurements)
  const energy = value.energyProfile
  const method = energy?.calculationMethod ?? 'mifflin'
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
  const setNumber = (key: 'bodyFatPercent' | 'measuredRestingKcal' | 'kcalPerKg' | 'adjustmentKcal' | 'targetKcal', raw: string) => setEnergy({ [key]: raw === '' ? undefined : Number(raw) })
  const macroGrams = macroTargets && macroValid && (energy?.targetKcal ?? estimate?.targetKcal) ? macroGramTargets(energy?.targetKcal ?? estimate!.targetKcal, macroTargets) : undefined
  const chooseMacroProfile = (raw: string) => {
    if (!raw) return setEnergy({ macroProfile: undefined, macroTargets: undefined })
    const profile = raw as MacroProfileId
    if (profile === 'custom') return setEnergy({ macroProfile: profile, macroTargets: macroTargets ?? { ...defaultMacroTargets } })
    const definition = macroProfiles.find(item => item.id === profile)!
    setEnergy({ macroProfile: profile, macroTargets: { ...definition.targets } })
  }

  return <details className="form-section" open><summary>Fabbisogno calorico e obiettivi giornalieri</summary><div className="form-stack">
    <div className="form-grid">
      <label>Metodo di calcolo<select value={method} onChange={event => setEnergy({ calculationMethod: event.target.value as EnergyCalculationMethod })}>{energyMethods.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label>Livello di attività fisica<select disabled={method === 'kcal-per-kg'} value={energy?.activityLevel ?? ''} onChange={event => setEnergy({ activityLevel: event.target.value ? event.target.value as EnergyProfile['activityLevel'] : undefined })}><option value="">Da indicare</option><option value="low">Basso / sedentario · PAL 1,4</option><option value="moderate">Moderato · PAL 1,6</option><option value="active">Attivo · PAL 1,8</option><option value="very-active">Molto attivo · PAL 2,0</option></select></label>
      <label>Obiettivo del percorso<select value={energy?.goal ?? ''} onChange={event => setEnergy({ goal: event.target.value ? event.target.value as EnergyProfile['goal'] : undefined })}><option value="">Da indicare</option><option value="lose">Riduzione del peso</option><option value="maintain">Mantenimento</option><option value="gain">Aumento del peso</option></select></label>
      {(method === 'cunningham' || method === 'katch-mcardle') && <label>Massa grassa misurata (%)<input type="number" min="0.1" max="75" step="0.1" value={energy?.bodyFatPercent ?? ''} onChange={event => setNumber('bodyFatPercent', event.target.value)} /></label>}
      {method === 'indirect-calorimetry' && <label>Dispendio a riposo misurato (kcal)<input type="number" min="200" max="10000" step="1" value={energy?.measuredRestingKcal ?? ''} onChange={event => setNumber('measuredRestingKcal', event.target.value)} /></label>}
      {method === 'kcal-per-kg' && <label>Coefficiente scelto (kcal/kg)<input type="number" min="5" max="100" step="0.1" value={energy?.kcalPerKg ?? ''} onChange={event => setNumber('kcalPerKg', event.target.value)} /></label>}
      <label>Correzione professionale (kcal/giorno)<input type="number" min="-3000" max="3000" step="50" value={energy?.adjustmentKcal ?? ''} placeholder="0" onChange={event => setNumber('adjustmentKcal', event.target.value)} /><small>Valore con segno, per esempio −300 oppure +200.</small></label>
    </div>

    {estimate ? <div className="energy-result">
      <div className="energy-result-heading"><div><span>Metodo selezionato</span><strong>{estimate.methodLabel}</strong></div><a href={estimate.source} target="_blank" rel="noreferrer">Fonte</a></div>
      <code>{estimate.formula}</code>
      <div className="energy-estimate">
        {estimate.restingKcal !== undefined && <div><span>Dispendio a riposo</span><strong>{format(estimate.restingKcal)} kcal</strong></div>}
        <div><span>{method === 'kcal-per-kg' ? 'Stima diretta giornaliera' : 'Mantenimento con PAL'}</span><strong>{format(estimate.dailyKcal)} kcal</strong></div>
        <div><span>Dopo la correzione</span><strong>{format(estimate.calculatedTargetKcal)} kcal</strong></div>
        <small>Dati usati: {format(estimate.weightKg, 1)} kg{estimate.heightCm ? ` · ${format(estimate.heightCm, 1)} cm` : ''} · {estimate.age} anni{estimate.activityFactor ? ` · PAL ${format(estimate.activityFactor, 1)}` : ''}{estimate.leanMassKg ? ` · massa magra ${format(estimate.leanMassKg, 1)} kg` : ''}.{estimate.olderThanOriginalSample ? ' Età oltre il campione originario Mifflin: interpretare con particolare cautela.' : ''}</small>
      </div>
      <button type="button" className="button secondary" onClick={() => setEnergy({ targetKcal: Math.round(estimate!.calculatedTargetKcal) })}>Usa {format(estimate.calculatedTargetKcal)} kcal come obiettivo modificabile</button>
    </div> : <p className="info-banner">Il metodo selezionato non è ancora calcolabile: {error}</p>}

    <label>Obiettivo energetico finale modificabile (kcal/giorno)<input type="number" min="1" max="10000" step="1" value={energy?.targetKcal ?? ''} placeholder={estimate ? String(Math.round(estimate.calculatedTargetKcal)) : ''} onChange={event => setNumber('targetKcal', event.target.value)} /><small>{energy?.targetKcal !== undefined ? 'Valore manuale attivo: è quello usato nel piano e nel generatore.' : 'Vuoto: il piano usa il risultato calcolato, quando disponibile.'}</small></label>
    {energy?.targetKcal !== undefined && <button type="button" className="text-link energy-reset" onClick={() => setEnergy({ targetKcal: undefined })}>Rimuovi il valore manuale e usa il calcolo</button>}

    <details className="energy-comparison"><summary>Confronta tutti i metodi ({energyMethods.length})</summary><div className="energy-method-list">{comparisons.map(item => <article key={item.method.id} className={item.method.id === method ? 'selected' : ''}><div><strong>{item.method.label}</strong><span>{item.method.description}</span></div>{item.estimate ? <div className="energy-method-value"><strong>{format(item.estimate.dailyKcal)} kcal</strong><small>{item.estimate.restingKcal !== undefined ? `riposo ${format(item.estimate.restingKcal)} · ` : ''}{item.estimate.formula}</small></div> : <small className="energy-method-missing">{item.error}</small>}<div className="energy-method-actions"><a href={item.estimate?.source ?? item.method.source} target="_blank" rel="noreferrer">Fonte</a><button type="button" className="text-link" onClick={() => setEnergy({ calculationMethod: item.method.id })}>{item.method.id === method ? 'Selezionato' : 'Usa metodo'}</button></div></article>)}</div></details>

    <p className="field-hint">Le equazioni sono stime per adulti e possono divergere. La calorimetria usa un valore realmente misurato; kcal/kg è una scorciatoia impostata dal professionista. Obiettivo del percorso e correzione non vengono dedotti automaticamente. I PAL sono riferimenti generali: <a href={energyReferenceSource} target="_blank" rel="noreferrer">riferimenti EFSA</a>.</p>
    <fieldset><legend>Ripartizione energetica obiettivo dei macronutrienti</legend>
      <label>Profilo di partenza<select value={macroProfile} onChange={event => chooseMacroProfile(event.target.value)}><option value="">Nessuna ripartizione</option>{macroProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.label}</option>)}<option value="custom">Personalizzata</option></select></label>
      {macroTargets && <><div className="macro-target-grid"><label>Carboidrati (%)<input type="number" min="0" max="100" step="1" value={macroTargets.carbsPercent} onChange={event => setEnergy({ macroTargets: { ...macroTargets, carbsPercent: Number(event.target.value) } })} /></label><label>Proteine (%)<input type="number" min="0" max="100" step="1" value={macroTargets.proteinPercent} onChange={event => setEnergy({ macroTargets: { ...macroTargets, proteinPercent: Number(event.target.value) } })} /></label><label>Grassi (%)<input type="number" min="0" max="100" step="1" value={macroTargets.fatPercent} onChange={event => setEnergy({ macroTargets: { ...macroTargets, fatPercent: Number(event.target.value) } })} /></label></div><p className={macroValid ? 'macro-total valid' : 'macro-total invalid'}>Totale: {format(macroTotal, 1)}% {macroValid ? '✓' : '· ogni valore deve essere 0–100 e il totale 100%'}{macroModified ? ' · modificato dal professionista' : ''}</p>
        {macroGrams && <p className="macro-grams">Con {format(energy?.targetKcal ?? estimate!.targetKcal)} kcal: circa <strong>{format(macroGrams.carbs, 1)} g carboidrati</strong>, <strong>{format(macroGrams.protein, 1)} g proteine</strong> e <strong>{format(macroGrams.fat, 1)} g grassi</strong>.</p>}
        <p className="field-hint">{macroDefinition ? <>Perché questo profilo: {macroDefinition.rationale} <a href={macroDefinition.source} target="_blank" rel="noreferrer">Riferimento</a>.</> : 'Profilo interamente definito dal professionista.'} Le percentuali sono un obiettivo operativo e restano sempre modificabili.</p>
      </>}
    </fieldset>
  </div></details>
}
