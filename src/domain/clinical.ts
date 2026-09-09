import { isLocalDate, today } from './diet'
import type { Diet, Measurement, Patient } from './models'

export function addYears(date: string, years: number) {
  const value = new Date(`${date}T12:00:00Z`)
  const month = value.getUTCMonth()
  value.setUTCFullYear(value.getUTCFullYear() + years)
  if (value.getUTCMonth() !== month) value.setUTCDate(0)
  return value.toISOString().slice(0, 10)
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
