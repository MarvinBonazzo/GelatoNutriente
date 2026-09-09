import { addYears } from './clinical'
import { isLocalDate, today } from './diet'
import type { Measurement, Patient } from './models'

export const anthropometrySource = 'https://www.nice.org.uk/guidance/ng246/chapter/Identifying-and-assessing-overweight-obesity-and-central-adiposity'
export function bodyMassIndex(weightKg: number, heightCm: number) {
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 1000 || !Number.isFinite(heightCm) || heightCm < 50 || heightCm > 250) throw new Error('Controlla peso e altezza: valori positivi, altezza tra 50 e 250 cm.')
  return weightKg / (heightCm / 100) ** 2
}
export function adultBmiCategory(bmi: number) {
  if (!Number.isFinite(bmi) || bmi <= 0) throw new Error('BMI non valido.')
  if (bmi < 18.5) return 'Sottopeso'
  if (bmi < 25) return 'Normopeso'
  if (bmi < 30) return 'Sovrappeso'
  if (bmi < 35) return 'Obesità classe I'
  if (bmi < 40) return 'Obesità classe II'
  return 'Obesità classe III'
}
export function adultReferenceEligibility(patient: Pick<Patient, 'birthDate' | 'anthropometryContext'>, date: string) {
  if (!patient.birthDate) return 'Indica la data di nascita per applicare i riferimenti per adulti.'
  if (!isLocalDate(patient.birthDate) || addYears(patient.birthDate, 18) > date) return 'Sotto i 18 anni servono curve BMI per età e sesso: le soglie per adulti non vengono applicate.'
  if (patient.anthropometryContext === 'pregnancy') return 'In gravidanza questi riferimenti di peso non vengono applicati: occorre una valutazione specifica.'
  if (patient.anthropometryContext === 'altered-composition') return 'Composizione corporea o stato dei fluidi non rappresentativi: classificazione e intervallo automatici sospesi.'
  return undefined
}
export function validatePatientAnthropometry(patient: Pick<Patient, 'birthDate' | 'initialAssessment'>) {
  if (patient.birthDate && (!isLocalDate(patient.birthDate) || patient.birthDate > today())) throw new Error('La data di nascita deve essere valida e non futura.')
  const initial = patient.initialAssessment
  if (!initial) return
  if (!isLocalDate(initial.date) || initial.date > today() || (patient.birthDate && initial.date < patient.birthDate)) throw new Error('La prima visita deve avere una data valida, dopo la nascita e non futura.')
  bodyMassIndex(initial.weightKg, initial.heightCm)
  if (initial.waistCm !== undefined && (!Number.isFinite(initial.waistCm) || initial.waistCm <= 0 || initial.waistCm > 1000)) throw new Error('La circonferenza vita deve essere positiva, non oltre 1.000 cm.')
}
/** A derived baseline observation, never duplicated in IndexedDB. */
export function measurementsWithBaseline(patient: Patient, measurements: Measurement[]) {
  const rows = measurements.filter(m => m.patientId === patient.id)
  const initial = patient.initialAssessment
  if (!initial) return rows
  const same = rows.some(m => m.date === initial.date && m.weightKg === initial.weightKg && m.heightCm === initial.heightCm && (initial.waistCm === undefined || m.circumferencesCm.waist === initial.waistCm))
  if (same) return rows
  return [...rows, { id: `baseline-${patient.id}`, patientId: patient.id, createdAt: patient.createdAt, updatedAt: patient.updatedAt, date: initial.date, weightKg: initial.weightKg, heightCm: initial.heightCm, circumferencesCm: { waist: initial.waistCm }, notes: 'Prima visita', enteredBy: 'nutritionist' as const }]
}
export function anthropometricSummary(patient: Patient, measurements: Measurement[], at = today()) {
  const baseline = patient.initialAssessment
  const actual = measurements.filter(m => m.patientId === patient.id && m.date <= at && (!baseline || m.date >= baseline.date))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
  const weightRecord = actual.find(m => m.weightKg !== undefined)
  const waistRecord = actual.find(m => m.circumferencesCm.waist !== undefined)
  const weight = weightRecord?.weightKg ?? baseline?.weightKg
  // Do not apply today's height retrospectively to a measurement lacking its own height.
  const height = weightRecord ? weightRecord.heightCm : baseline?.heightCm
  const date = weightRecord?.date ?? baseline?.date
  const bmi = weight !== undefined && height ? bodyMassIndex(weight, height) : undefined
  const blocked = adultReferenceEligibility(patient, date ?? at)
  const waist = waistRecord?.circumferencesCm.waist ?? baseline?.waistCm
  const waistHeight = waistRecord ? waistRecord.heightCm : baseline?.heightCm
  const waistDate = waistRecord?.date ?? baseline?.date
  const ratio = waist && waistHeight ? waist / waistHeight : undefined
  const waistBmi = waistRecord?.weightKg !== undefined && waistHeight ? bodyMassIndex(waistRecord.weightKg, waistHeight) : !waistRecord && baseline ? bodyMassIndex(baseline.weightKg, baseline.heightCm) : undefined
  const ratioInterpretable = !adultReferenceEligibility(patient, waistDate ?? at) && waistBmi !== undefined && waistBmi < 35 && ratio !== undefined && ratio >= .4
  const rangeHeight = patient.heightCm ?? height
  const currentBlocked = adultReferenceEligibility(patient, at)
  return {
    baseline, weight, height, date, bmi, blocked,
    category: bmi !== undefined && !blocked ? adultBmiCategory(bmi) : undefined,
    changeKg: baseline && weight !== undefined ? weight - baseline.weightKg : undefined,
    changePercent: baseline && weight !== undefined ? (weight - baseline.weightKg) / baseline.weightKg * 100 : undefined,
    initialBmi: baseline ? bodyMassIndex(baseline.weightKg, baseline.heightCm) : undefined,
    range: rangeHeight && !currentBlocked ? { min: 18.5 * (rangeHeight / 100) ** 2, maxExclusive: 25 * (rangeHeight / 100) ** 2, height: rangeHeight } : undefined,
    targetBmi: patient.targetWeight && rangeHeight ? bodyMassIndex(patient.targetWeight.kg, rangeHeight) : undefined,
    targetDifference: patient.targetWeight && weight !== undefined ? patient.targetWeight.kg - weight : undefined,
    ratio, waist, waistHeight, waistDate, ratioInterpretable,
    ratioCategory: ratioInterpretable ? ratio! < .5 ? 'Adiposità centrale non aumentata' : ratio! < .6 ? 'Adiposità centrale aumentata' : 'Adiposità centrale elevata' : undefined,
    olderAdult: !!patient.birthDate && addYears(patient.birthDate, 65) <= at,
  }
}
