import { isLocalDate, today } from './diet'
import type { Diet, Measurement, Patient } from './models'

export function addYears(date: string, years: number) {
  const value = new Date(`${date}T12:00:00Z`)
  const month = value.getUTCMonth()
  value.setUTCFullYear(value.getUTCFullYear() + years)
  if (value.getUTCMonth() !== month) value.setUTCDate(0)
  return value.toISOString().slice(0, 10)
}

export const energyFormulaSource = 'https://pubmed.ncbi.nlm.nih.gov/2305711/'
export const energyReferenceSource = 'https://www.efsa.europa.eu/sites/default/files/2017_09_DRVs_summary_report.pdf'
type ActivityLevel = NonNullable<NonNullable<Patient['energyProfile']>['activityLevel']>
export type EnergyCalculationMethod = NonNullable<NonNullable<Patient['energyProfile']>['calculationMethod']>
export const activityFactors: Record<ActivityLevel, number> = {
  low: 1.4,
  moderate: 1.6,
  active: 1.8,
  'very-active': 2,
}

export const energyMethods: { id: EnergyCalculationMethod; label: string; description: string; source: string }[] = [
  { id: 'mifflin', label: 'Mifflin–St Jeor (1990)', description: 'Peso, altezza, età e sesso.', source: 'https://pubmed.ncbi.nlm.nih.gov/2305711/' },
  { id: 'harris-original', label: 'Harris–Benedict originale (1919)', description: 'Peso, altezza, età e sesso; mantenuta per confronto storico.', source: 'https://pubmed.ncbi.nlm.nih.gov/6741850/' },
  { id: 'harris-revised', label: 'Harris–Benedict rivista (1984)', description: 'Revisione Roza–Shizgal con peso, altezza, età e sesso.', source: 'https://pubmed.ncbi.nlm.nih.gov/6741850/' },
  { id: 'schofield', label: 'Schofield (1985)', description: 'Peso, fascia di età e sesso.', source: 'https://pubmed.ncbi.nlm.nih.gov/4044297/' },
  { id: 'owen', label: 'Owen (1986–1987)', description: 'Equazione semplificata basata su peso e sesso.', source: 'https://pubmed.ncbi.nlm.nih.gov/3687821/' },
  { id: 'cunningham', label: 'Cunningham (1980)', description: 'Usa la massa magra derivata dalla percentuale di grasso.', source: 'https://pubmed.ncbi.nlm.nih.gov/7435418/' },
  { id: 'katch-mcardle', label: 'Katch–McArdle', description: 'Usa la massa magra derivata dalla percentuale di grasso.', source: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9246861/' },
  { id: 'indirect-calorimetry', label: 'Calorimetria indiretta', description: 'Parte dal dispendio a riposo misurato e applica il PAL.', source: 'https://clinicalnutrition.science/cms/upload/dateien/NutriBib/2_Nutritional_Management/2.4_Nutritional_Assessment/2019_Delsoglio.pdf' },
  { id: 'kcal-per-kg', label: 'Coefficiente kcal/kg', description: 'Stima rapida diretta: peso × coefficiente scelto dal professionista.', source: 'https://2022.espen.org/files/ESPEN-Guidelines/ESPEN_guideline_on_hospital_nutrition.pdf' },
]

type EnergyProfile = NonNullable<Patient['energyProfile']>
export type GoalStrategy = NonNullable<EnergyProfile['goalStrategy']>
export const goalStrategies: { id: GoalStrategy; label: string; description: string; source: string }[] = [
  { id: 'percentage', label: 'Percentuale del mantenimento', description: 'Applica una percentuale al TDEE: predefinita −15% per dimagrimento e +10% per aumento.', source: 'https://www.niddk.nih.gov/health-information/weight-management/adult-overweight-obesity/eating-physical-activity' },
  { id: 'fixed-kcal', label: 'Scarto fisso in kcal', description: 'Sottrae o aggiunge un valore giornaliero: predefinito −500 kcal o +250 kcal.', source: 'https://www.nice.org.uk/guidance/ng246/evidence/cg43-full-guideline-section-5b-management-of-in-clinical-settings-adults-evidence-statements-and-reviews-pdf-195027234' },
  { id: 'weekly-rate', label: 'Ritmo teorico kg/settimana', description: 'Converte il ritmo scelto con la regola statica di circa 7.700 kcal/kg; non simula l’adattamento metabolico.', source: 'https://pubmed.ncbi.nlm.nih.gov/23628852/' },
  { id: 'none', label: 'Nessuna variazione automatica', description: 'Mantiene le kcal del TDEE; il professionista può usare la correzione o l’obiettivo manuale.', source: 'https://www.niddk.nih.gov/research-funding/technology-advancement-transfer/research-materials-licensing/body-weight-simulator-java-applet' },
]

function goalAdjustment(profile: EnergyProfile, maintenanceKcal: number) {
  const goal = profile.goal
  if (!goal || goal === 'maintain') return { goalStrategy: 'none' as const, goalStrategyLabel: 'Mantenimento', goalStrategySource: goalStrategies[3].source, goalAdjustmentKcal: 0, goalAdjustedKcal: maintenanceKcal, goalFormula: 'Mantenimento: nessun deficit o surplus' }
  const direction = goal === 'lose' ? -1 : 1
  const strategy = profile.goalStrategy ?? 'percentage'
  const definition = goalStrategies.find(item => item.id === strategy)!
  let magnitude = 0
  let formula = definition.description
  if (strategy === 'percentage') {
    const percent = profile.goalPercent ?? (goal === 'lose' ? 15 : 10)
    if (!Number.isFinite(percent) || percent < 1 || percent > 40) throw new Error('La percentuale dell’obiettivo deve essere compresa tra 1 e 40%.')
    magnitude = maintenanceKcal * percent / 100
    formula = `${goal === 'lose' ? '−' : '+'}${percent}% di ${Math.round(maintenanceKcal)} kcal`
  } else if (strategy === 'fixed-kcal') {
    const fixedKcal = profile.goalFixedKcal ?? (goal === 'lose' ? 500 : 250)
    if (!Number.isFinite(fixedKcal) || fixedKcal < 50 || fixedKcal > 2000) throw new Error('Lo scarto fisso deve essere compreso tra 50 e 2.000 kcal.')
    magnitude = fixedKcal
    formula = `${goal === 'lose' ? '−' : '+'}${fixedKcal} kcal/giorno`
  } else if (strategy === 'weekly-rate') {
    const weeklyKg = profile.goalWeeklyKg ?? (goal === 'lose' ? .5 : .25)
    if (!Number.isFinite(weeklyKg) || weeklyKg < .05 || weeklyKg > 2) throw new Error('Il ritmo teorico deve essere compreso tra 0,05 e 2 kg/settimana.')
    magnitude = weeklyKg * 7700 / 7
    formula = `${goal === 'lose' ? '−' : '+'}${weeklyKg} kg/settimana × 7.700 ÷ 7`
  }
  const goalAdjustmentKcal = direction * magnitude
  return { goalStrategy: strategy, goalStrategyLabel: definition.label, goalStrategySource: definition.source, goalAdjustmentKcal, goalAdjustedKcal: Math.max(1, maintenanceKcal + goalAdjustmentKcal), goalFormula: formula }
}

export function ageOnDate(birthDate: string, date = today()) {
  if (!isLocalDate(birthDate) || !isLocalDate(date) || birthDate > date) throw new Error('Data di nascita non valida.')
  let age = Number(date.slice(0, 4)) - Number(birthDate.slice(0, 4))
  if (date.slice(5) < birthDate.slice(5)) age--
  return age
}

type EnergyPatient = Pick<Patient, 'id' | 'birthDate' | 'heightCm' | 'sexForFormula' | 'initialAssessment' | 'anthropometryContext' | 'energyProfile'>

function energyInputs(patient: EnergyPatient, measurements: Measurement[], date: string) {
  if (!patient.birthDate) throw new Error('Indica la data di nascita.')
  const age = ageOnDate(patient.birthDate, date)
  if (age < 19) throw new Error('La stima automatica è disponibile dai 19 anni.')
  if (patient.anthropometryContext === 'pregnancy') throw new Error('In gravidanza la stima automatica è sospesa: serve una valutazione specifica.')
  if (patient.anthropometryContext === 'altered-composition') throw new Error('Con composizione corporea o fluidi alterati la stima automatica è sospesa.')
  const heightCm = patient.heightCm ?? patient.initialAssessment?.heightCm
  const latestWeight = measurements
    .filter(m => m.patientId === patient.id && m.date <= date && m.weightKg !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))[0]
  const weightKg = latestWeight?.weightKg ?? patient.initialAssessment?.weightKg
  if (!weightKg || !Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 1000) throw new Error('Inserisci il peso della prima visita o una misurazione recente.')
  return { age, weightKg, heightCm, sex: patient.sexForFormula, profile: patient.energyProfile ?? {} }
}

/** Adult estimate. Predictive or measured REE is multiplied by PAL; kcal/kg is already a direct daily estimate. */
export function estimateEnergyNeeds(patient: EnergyPatient, measurements: Measurement[] = [], date = today(), methodOverride?: EnergyCalculationMethod) {
  const { age, weightKg, heightCm, sex, profile } = energyInputs(patient, measurements, date)
  const method = methodOverride ?? profile.calculationMethod ?? 'mifflin'
  const definition = energyMethods.find(item => item.id === method)!
  const needsSex = ['mifflin', 'harris-original', 'harris-revised', 'schofield', 'owen'].includes(method)
  const needsHeight = ['mifflin', 'harris-original', 'harris-revised'].includes(method)
  if (needsSex && !sex) throw new Error('Indica il sesso usato dalla formula.')
  if (needsHeight && (!heightCm || !Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250)) throw new Error('Inserisci un’altezza valida.')
  const activityLevel = profile.activityLevel
  const needsPal = method !== 'kcal-per-kg'
  if (needsPal && !activityLevel) throw new Error('Seleziona il livello di attività fisica.')

  let restingKcal: number | undefined
  let dailyKcal: number
  let formula: string
  let leanMassKg: number | undefined
  if (method === 'kcal-per-kg') {
    const coefficient = profile.kcalPerKg
    if (!coefficient || coefficient < 5 || coefficient > 100) throw new Error('Inserisci un coefficiente tra 5 e 100 kcal/kg.')
    dailyKcal = weightKg * coefficient
    formula = `${weightKg} kg × ${coefficient} kcal/kg`
  } else if (method === 'indirect-calorimetry') {
    restingKcal = profile.measuredRestingKcal
    if (!restingKcal || restingKcal < 200 || restingKcal > 10000) throw new Error('Inserisci il dispendio a riposo misurato con calorimetria.')
    dailyKcal = restingKcal * activityFactors[activityLevel!]
    formula = `${restingKcal} kcal misurate × PAL ${activityFactors[activityLevel!]}`
  } else {
    if (method === 'mifflin') {
      restingKcal = 10 * weightKg + 6.25 * heightCm! - 5 * age + (sex === 'male' ? 5 : -161)
      formula = `10 × peso + 6,25 × altezza − 5 × età ${sex === 'male' ? '+ 5' : '− 161'}`
    } else if (method === 'harris-original') {
      restingKcal = sex === 'male' ? 66.473 + 13.7516 * weightKg + 5.0033 * heightCm! - 6.755 * age : 655.0955 + 9.5634 * weightKg + 1.8496 * heightCm! - 4.6756 * age
      formula = sex === 'male' ? '66,473 + 13,7516 × peso + 5,0033 × altezza − 6,755 × età' : '655,0955 + 9,5634 × peso + 1,8496 × altezza − 4,6756 × età'
    } else if (method === 'harris-revised') {
      restingKcal = sex === 'male' ? 88.362 + 13.397 * weightKg + 4.799 * heightCm! - 5.677 * age : 447.593 + 9.247 * weightKg + 3.098 * heightCm! - 4.33 * age
      formula = sex === 'male' ? '88,362 + 13,397 × peso + 4,799 × altezza − 5,677 × età' : '447,593 + 9,247 × peso + 3,098 × altezza − 4,330 × età'
    } else if (method === 'schofield') {
      const [coefficient, constant] = sex === 'male'
        ? age < 30 ? [15.057, 692.2] : age < 60 ? [11.472, 873.1] : [11.711, 587.7]
        : age < 30 ? [14.818, 486.6] : age < 60 ? [8.126, 845.6] : [9.082, 658.5]
      restingKcal = coefficient * weightKg + constant
      formula = `${String(coefficient).replace('.', ',')} × peso + ${String(constant).replace('.', ',')} (${sex === 'male' ? 'uomo' : 'donna'}, ${age < 30 ? '18–29' : age < 60 ? '30–59' : '≥60'} anni)`
    } else if (method === 'owen') {
      restingKcal = sex === 'male' ? 879 + 10.2 * weightKg : 795 + 7.18 * weightKg
      formula = sex === 'male' ? '879 + 10,2 × peso' : '795 + 7,18 × peso'
    } else {
      const bodyFatPercent = profile.bodyFatPercent
      if (!bodyFatPercent || bodyFatPercent <= 0 || bodyFatPercent > 75) throw new Error('Inserisci una percentuale di massa grassa tra 0 e 75%.')
      leanMassKg = weightKg * (1 - bodyFatPercent / 100)
      if (method === 'cunningham') {
        restingKcal = 500 + 22 * leanMassKg
        formula = '500 + 22 × massa magra'
      } else {
        restingKcal = 370 + 21.6 * leanMassKg
        formula = '370 + 21,6 × massa magra'
      }
    }
    dailyKcal = restingKcal * activityFactors[activityLevel!]
  }
  const goalResult = goalAdjustment(profile, dailyKcal)
  const adjustmentKcal = profile.adjustmentKcal ?? 0
  if (!Number.isFinite(adjustmentKcal) || adjustmentKcal < -3000 || adjustmentKcal > 3000) throw new Error('La correzione professionale deve essere compresa tra −3.000 e +3.000 kcal.')
  const calculatedTargetKcal = Math.max(1, goalResult.goalAdjustedKcal + adjustmentKcal)
  if (profile.targetKcal !== undefined && (!Number.isFinite(profile.targetKcal) || profile.targetKcal <= 0 || profile.targetKcal > 10000)) throw new Error('L’obiettivo manuale deve essere positivo e non oltre 10.000 kcal.')
  const targetKcal = profile.targetKcal ?? calculatedTargetKcal
  const source = method === 'owen' && sex === 'female' ? 'https://pubmed.ncbi.nlm.nih.gov/3728346/' : definition.source
  return {
    method, methodLabel: definition.label, methodDescription: definition.description, source, formula,
    age, weightKg, heightCm, restingKcal, maintenanceKcal: dailyKcal, dailyKcal, ...goalResult, adjustmentKcal, calculatedTargetKcal, targetKcal,
    manualOverride: profile.targetKcal !== undefined, activityFactor: needsPal ? activityFactors[activityLevel!] : undefined, leanMassKg,
    olderThanOriginalSample: method === 'mifflin' && age > 78, targetBelowResting: restingKcal !== undefined && calculatedTargetKcal < restingKcal,
  }
}

export function compareEnergyMethods(patient: EnergyPatient, measurements: Measurement[] = [], date = today()) {
  return energyMethods.map(method => {
    try { return { method, estimate: estimateEnergyNeeds(patient, measurements, date, method.id) } }
    catch (error) { return { method, error: error instanceof Error ? error.message : 'Dati insufficienti.' } }
  })
}

/** Manual target remains usable even when the selected estimation method has incomplete inputs. */
export function resolveEnergyTarget(patient: EnergyPatient, measurements: Measurement[] = [], date = today()) {
  const manual = patient.energyProfile?.targetKcal
  if (manual !== undefined) {
    if (!Number.isFinite(manual) || manual <= 0 || manual > 10000) throw new Error('L’obiettivo manuale deve essere positivo e non oltre 10.000 kcal.')
    return { targetKcal: manual, manualOverride: true as const }
  }
  const estimate = estimateEnergyNeeds(patient, measurements, date)
  return { targetKcal: estimate.targetKcal, manualOverride: false as const, methodLabel: estimate.methodLabel }
}
export const patientDiets = (diets: Diet[], patientId: string, date = today()) => diets.filter(d => d.patientId === patientId && (d.patientVisible ?? d.status === 'assigned') && (!d.endsOn || date <= addYears(d.endsOn, 1)))
export const recentMeasurements = (values: Measurement[], date = today()) => values.filter(m => m.date >= addYears(date, -2) && m.date <= date)

export function validateMeasurement(m: Measurement) {
  if (!isLocalDate(m.date) || m.date > today()) throw new Error('Inserisci una data valida, non futura.')
  if (m.heightCm !== undefined && (!Number.isFinite(m.heightCm) || m.heightCm < 50 || m.heightCm > 250)) throw new Error('Altezza della misurazione non valida (50–250 cm).')
  const values = [m.weightKg, ...Object.values(m.circumferencesCm)].filter(v => v !== undefined)
  if (!values.length || values.some(v => !Number.isFinite(v) || v! <= 0 || v! > 1000)) throw new Error('Inserisci almeno una misura positiva, non oltre 1.000.')
  if (!m.patientId) throw new Error('Seleziona un paziente.')
}

export type WeightFormula = 'devine' | 'robinson' | 'miller' | 'bmi'
export const weightFormulaSource = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4841935/'
/** Historical reference equations, not automatic nutritional targets. */
export function referenceWeight(patient: Pick<Patient, 'birthDate' | 'heightCm' | 'sexForFormula'>, formula: WeightFormula, bmi = 22, date = today()) {
  if (!patient.birthDate || !isLocalDate(patient.birthDate) || addYears(patient.birthDate, 18) > date) throw new Error('Il confronto è disponibile soltanto per adulti con data di nascita indicata.')
  const h = patient.heightCm
  if (!h || !Number.isFinite(h) || h < 100 || h > 250) throw new Error('Inserisci un’altezza valida in centimetri.')
  if (formula === 'bmi') {
    if (!Number.isFinite(bmi) || bmi < 15 || bmi > 40) throw new Error('Inserisci un BMI di riferimento tra 15 e 40.')
    return bmi * (h / 100) ** 2
  }
  if (h < 152.4) throw new Error('Queste formule non vengono estrapolate sotto 152,4 cm. Scegli un altro riferimento.')
  if (!patient.sexForFormula) throw new Error('Indica il sesso usato dalla formula storica.')
  const inches = h / 2.54 - 60
  const female = patient.sexForFormula === 'female'
  if (formula === 'devine') return (female ? 45.5 : 50) + 2.3 * inches
  if (formula === 'robinson') return (female ? 49 : 52) + (female ? 1.7 : 1.9) * inches
  return (female ? 53.1 : 56.2) + (female ? 1.36 : 1.41) * inches
}
