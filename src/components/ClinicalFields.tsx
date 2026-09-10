import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Patient } from '../domain/models'
import { id, now, today } from '../domain/diet'
import { referenceWeight, weightFormulaSource, type WeightFormula } from '../domain/clinical'
import { findMedicationEffect, medicationEffects } from '../data/medication-effects'
import { useAppStore } from '../store/app-store'
import { AnthropometryPanel } from './AnthropometryPanel'
import { format } from './NutrientSummary'
import { EnergyCalculator } from './EnergyCalculator'

export type ClinicalProfile = Pick<Patient, 'initialAssessment' | 'anthropometryContext' | 'birthDate' | 'heightCm' | 'sexForFormula' | 'targetWeight' | 'energyProfile' | 'intake' | 'medications'>

const intakeQuestions = [
  ['preferences', 'Quali alimenti, sapori e cucine preferisce?'],
  ['exclusions', 'Quali alimenti non gradisce o desidera escludere?'],
  ['allergies', 'Ha allergie o intolleranze diagnosticate o sospette?'],
  ['habits', 'Descriva una giornata alimentare abituale, inclusi spuntini e pasti fuori casa'],
  ['mealsAndSchedule', 'Quanti pasti fa e a quali orari? Ci sono turni o orari variabili?'],
  ['workAndActivity', 'Che lavoro svolge e quanto si muove durante la giornata e nel tempo libero?'],
  ['cookingAndBudget', 'Quanto tempo ha per cucinare? Ha vincoli di spesa, strumenti o organizzazione?'],
  ['hydration', 'Quanta acqua beve? Consuma bibite, caffè o bevande energetiche?'],
  ['sleepAndStress', 'Come sono sonno, stress, fame emotiva e ritmo quotidiano?'],
  ['digestion', 'Ha sintomi digestivi, alvo irregolare o alimenti che scatenano disturbi?'],
  ['conditions', 'Ci sono diagnosi, esami recenti o condizioni cliniche da considerare?'],
  ['supplements', 'Assume integratori o prodotti erboristici? Indicare prodotto e dose'],
  ['alcoholAndSmoking', 'Consuma alcol o fuma? Con quale frequenza e quantità?'],
  ['dietHistory', 'Quali diete ha già seguito e con quali risultati o difficoltà?'],
] as const

export function ClinicalFields({ value, onChange, patientId }: { patientId?: string; value: ClinicalProfile; onChange: (value: ClinicalProfile) => void }) {
  const foods = useAppStore(s => s.foods)
  const measurements = useAppStore(s => s.measurements)
  const [formula, setFormula] = useState<WeightFormula>('devine')
  const [bmi, setBmi] = useState(22)
  const [ingredient, setIngredient] = useState(''); const [product, setProduct] = useState('')
  let calculated: number | undefined; let calculationError = ''
  try { if (value.anthropometryContext && value.anthropometryContext !== 'standard') throw new Error('Riferimenti automatici sospesi nel contesto clinico selezionato. Puoi inserire un obiettivo concordato manualmente.'); calculated = referenceWeight(value, formula, bmi) } catch (e) { calculationError = e instanceof Error ? e.message : 'Completa i dati.' }
  const intake = value.intake ?? { preferences: '', exclusions: '', allergies: '', habits: '', preferredFoodIds: [], excludedFoodIds: [] }
  return <>
    <details className="form-section" open><summary>Prima visita, BMI e peso obiettivo</summary><div className="form-stack">
      <div className="form-grid"><label>Data di nascita<input type="date" max={today()} value={value.birthDate ?? ''} onChange={e => onChange({ ...value, birthDate: e.target.value || undefined })} /></label><label>Altezza attuale (cm)<input type="number" min="50" max="250" step="0.1" value={value.heightCm ?? ''} onChange={e => onChange({ ...value, heightCm: e.target.value ? Number(e.target.value) : undefined })} /></label></div>
      <label>Sesso usato dalle formule storiche<select value={value.sexForFormula ?? ''} onChange={e => onChange({ ...value, sexForFormula: e.target.value as Patient['sexForFormula'] || undefined })}><option value="">Non indicato</option><option value="female">Femminile</option><option value="male">Maschile</option></select></label>
      <div className="baseline-form"><h3>Prima visita · peso iniziale</h3><p className="field-hint">Il punto di partenza del percorso. Le misurazioni successive non sovrascrivono questi valori.</p><div className="form-grid">
        <label>Peso iniziale (kg)<input type="number" min="0.1" max="1000" step="0.1" value={value.initialAssessment?.weightKg ?? ''} onChange={e => onChange({ ...value, initialAssessment: e.target.value ? { date: today(), heightCm: value.heightCm ?? 0, ...value.initialAssessment, weightKg: Number(e.target.value) } : undefined })} /></label>
        <label>Data prima visita<input type="date" required={!!value.initialAssessment} max={today()} min={value.birthDate} value={value.initialAssessment?.date ?? ''} disabled={!value.initialAssessment} onChange={e => { if (value.initialAssessment) onChange({ ...value, initialAssessment: { ...value.initialAssessment, date: e.target.value } }) }} /></label>
        <label>Altezza alla prima visita (cm)<input type="number" min="50" max="250" step="0.1" required={!!value.initialAssessment} disabled={!value.initialAssessment} value={value.initialAssessment?.heightCm || ''} onChange={e => { if (value.initialAssessment) onChange({ ...value, heightCm: value.heightCm ?? (e.target.value ? Number(e.target.value) : undefined), initialAssessment: { ...value.initialAssessment, heightCm: Number(e.target.value) } }) }} /></label>
        <label>Vita alla prima visita (cm)<input type="number" min="0.1" max="1000" step="0.1" disabled={!value.initialAssessment} value={value.initialAssessment?.waistCm ?? ''} onChange={e => { if (value.initialAssessment) onChange({ ...value, initialAssessment: { ...value.initialAssessment, waistCm: e.target.value ? Number(e.target.value) : undefined } }) }} /></label>
      </div></div>
      <label>Contesto per i riferimenti antropometrici<select value={value.anthropometryContext ?? 'standard'} onChange={e => onChange({ ...value, anthropometryContext: e.target.value as Patient['anthropometryContext'] })}><option value="standard">Valutazione standard</option><option value="pregnancy">Gravidanza · riferimenti automatici sospesi</option><option value="altered-composition">Composizione corporea / fluidi alterati · riferimenti sospesi</option></select></label>
      <AnthropometryPanel patient={{ ...value, id: patientId ?? 'preview', createdAt: '', updatedAt: '', name: '', goals: '', notes: '' }} measurements={measurements} />
      <div className="reference-box"><label>Formula di riferimento<select value={formula} onChange={e => setFormula(e.target.value as WeightFormula)}><option value="devine">Devine (1974)</option><option value="robinson">Robinson (1983)</option><option value="miller">Miller (1983)</option><option value="bmi">Peso corrispondente a un BMI scelto</option></select></label>{formula === 'bmi' && <label>BMI di riferimento<input type="number" step="0.1" min="15" max="40" value={bmi} onChange={e => setBmi(Number(e.target.value))} /></label>}
        {calculated !== undefined ? <div className="reference-result"><strong>{format(calculated, 1)} kg</strong><button type="button" className="button secondary" onClick={() => onChange({ ...value, targetWeight: { kg: Math.round(calculated! * 10) / 10, method: formula, confirmedAt: now() } })}>Conferma come obiettivo</button></div> : <p className="field-hint">{calculationError}</p>}
        <p className="field-hint">Stime storiche per adulti, non prescrizioni. Non applicarle automaticamente in gravidanza, allattamento o condizioni che alterano la composizione corporea. L’obiettivo va concordato e valutato clinicamente. <a href={weightFormulaSource} target="_blank" rel="noreferrer">Formule e limiti</a>.</p>
      </div>
      <label>Obiettivo concordato (kg)<input type="number" min="0.1" max="1000" step="0.1" value={value.targetWeight?.kg ?? ''} onChange={e => onChange({ ...value, targetWeight: e.target.value ? { kg: Number(e.target.value), method: 'manual', confirmedAt: now() } : undefined })} /></label>
    </div></details>

    <EnergyCalculator patientId={patientId} value={value} onChange={onChange} />

    <details className="form-section"><summary>Questionario alimentare e stile di vita · {intakeQuestions.length} domande</summary><div className="form-stack">
      {intakeQuestions.map(([key, label], index) => <label key={key}><span className="question-number">{index + 1}</span>{label}<textarea rows={2} maxLength={3000} value={intake[key] ?? ''} onChange={e => onChange({ ...value, intake: { ...intake, [key]: e.target.value } })} /></label>)}
      <label>Alimenti preferiti nel generatore<select multiple size={8} value={intake.preferredFoodIds} onChange={e => onChange({ ...value, intake: { ...intake, preferredFoodIds: [...e.target.selectedOptions].map(o => o.value) } })}>{foods.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <label>Alimenti esclusi dal generatore<select multiple size={8} value={intake.excludedFoodIds} onChange={e => onChange({ ...value, intake: { ...intake, excludedFoodIds: [...e.target.selectedOptions].map(o => o.value) } })}>{foods.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><p className="field-hint">Selezione multipla: usa Ctrl/Cmd sul computer. Le esclusioni selezionate sono vincoli del generatore; allergie e testo libero richiedono una verifica del nutrizionista.</p>
    </div></details>
    <details className="form-section"><summary>Farmaci e metabolismo</summary><div className="form-stack">
      <p className="field-hint">Catalogo iniziale limitato a {medicationEffects.length} principi attivi. Le schede segnalano possibili effetti descritti nelle fonti; non attribuiscono la causa delle misurazioni e non suggeriscono modifiche alla terapia.</p>
      <div className="form-grid"><label>Principio attivo<input list="medication-ingredients" value={ingredient} onChange={e => setIngredient(e.target.value)} placeholder="Es. olanzapina" /><datalist id="medication-ingredients">{medicationEffects.map(m => <option key={m.ingredient}>{m.ingredient}</option>)}</datalist></label><label>Prodotto / nota<input value={product} maxLength={200} onChange={e => setProduct(e.target.value)} /></label></div><button type="button" className="button secondary" disabled={!ingredient.trim()} onClick={() => { onChange({ ...value, medications: [...(value.medications ?? []), { id: id(), activeIngredient: ingredient.trim(), product: product.trim(), notes: '', active: true }] }); setIngredient(''); setProduct('') }}><Plus size={16} />Aggiungi farmaco</button>
      {(value.medications ?? []).map(m => { const effect = findMedicationEffect(m.activeIngredient); return <article className="medication-card" key={m.id}><header><strong>{m.activeIngredient}</strong><button type="button" className="icon-button" aria-label={`Rimuovi ${m.activeIngredient}`} onClick={() => onChange({ ...value, medications: value.medications?.filter(item => item.id !== m.id) })}><Trash2 size={16} /></button></header><p>{m.product}</p><label className="inline-check"><input type="checkbox" checked={m.active} onChange={e => onChange({ ...value, medications: value.medications?.map(item => item.id === m.id ? { ...item, active: e.target.checked } : item) })} />Assunzione attuale</label>{m.active && (effect ? <><p>{effect.effect}</p><a className="text-link" href={effect.source} target="_blank" rel="noreferrer">{effect.section}</a><small>Verificato il {effect.checkedOn}</small><p className="field-hint">Da discutere con medico o farmacista; non sospendere o modificare autonomamente il farmaco.</p></> : <p className="shopping-warning">Principio attivo non coperto: controllare il RCP aggiornato. L’assenza di una segnalazione non significa assenza di possibili effetti o interazioni.</p>)}</article> })}
    </div></details>
  </>
}
