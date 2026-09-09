import { describe, expect, it } from 'vitest'
import { adultBmiCategory, adultReferenceEligibility, anthropometricSummary, bodyMassIndex, measurementsWithBaseline, validatePatientAnthropometry } from './anthropometry'
import type { Measurement, Patient } from './models'
const patient: Patient = { id: 'patient', name: 'Test', goals: '', notes: '', createdAt: '2026-01-01T12:00:00Z', updatedAt: '2026-01-01T12:00:00Z', birthDate: '1980-01-01', heightCm: 180, initialAssessment: { date: '2026-01-01', weightKg: 90, heightCm: 180, waistCm: 99 }, targetWeight: { kg: 81, method: 'manual', confirmedAt: '2026-01-01T12:00:00Z' } }
const measurement: Measurement = { id: 'measure', patientId: patient.id, date: '2026-02-01', createdAt: '2026-02-01T12:00:00Z', updatedAt: '2026-02-01T12:00:00Z', weightKg: 81, heightCm: 180, circumferencesCm: { waist: 90 }, notes: '', enteredBy: 'nutritionist' }
describe('anthropometric assessment', () => {
  it('calculates BMI without premature rounding', () => {
    expect(bodyMassIndex(81, 180)).toBe(25)
    expect(adultBmiCategory(bodyMassIndex(80.999, 180))).toBe('Normopeso')
    expect(() => bodyMassIndex(0, 180)).toThrow()
    expect(() => bodyMassIndex(NaN, 180)).toThrow()
    expect(() => bodyMassIndex(81, 0)).toThrow()
  })
  it.each([[18.4999, 'Sottopeso'], [18.5, 'Normopeso'], [24.9999, 'Normopeso'], [25, 'Sovrappeso'], [30, 'Obesità classe I'], [35, 'Obesità classe II'], [40, 'Obesità classe III']] as const)('classifies exact boundary %s', (bmi, category) => expect(adultBmiCategory(bmi)).toBe(category))
  it('keeps baseline independent, uses the last dated measurement and shows signed changes', () => {
    const s = anthropometricSummary(patient, [measurement, { ...measurement, date: '2025-12-01', weightKg: 100 }, { ...measurement, id: 'foreign', patientId: 'someone', weightKg: 40 }], '2026-03-01')
    expect(s.weight).toBe(81); expect(s.changeKg).toBe(-9); expect(s.changePercent).toBe(-10)
    expect(s.initialBmi).toBeCloseTo(27.777777); expect(s.bmi).toBe(25)
    expect(s.targetBmi).toBe(25); expect(s.targetDifference).toBe(0)
    expect(s.range?.min).toBeCloseTo(59.94); expect(s.range?.maxExclusive).toBe(81)
    expect(patient.initialAssessment?.weightKg).toBe(90)
  })
  it('uses baseline when no later weight exists and never substitutes waist-only visits for weight', () => {
    const s = anthropometricSummary(patient, [{ ...measurement, weightKg: undefined }], '2026-03-01')
    expect(s.weight).toBe(90); expect(s.date).toBe('2026-01-01')
    expect(s.waistDate).toBe('2026-02-01'); expect(s.ratio).toBe(.5)
    expect(s.ratioInterpretable).toBe(false)
  })
  it('does not recalculate historical BMI with the current patient height', () => {
    expect(anthropometricSummary({ ...patient, heightCm: 160 }, [measurement], '2026-03-01').bmi).toBe(25)
    const legacy = anthropometricSummary(patient, [{ ...measurement, heightCm: undefined }], '2026-03-01')
    expect(legacy.weight).toBe(81); expect(legacy.bmi).toBeUndefined()
  })
  it('does not apply adult references to children, unknown ages or specific clinical contexts', () => {
    expect(adultReferenceEligibility({ birthDate: '2010-01-01' }, '2026-01-01')).toContain('18 anni')
    expect(adultReferenceEligibility({}, '2026-01-01')).toContain('nascita')
    expect(adultReferenceEligibility({ birthDate: '2008-01-01' }, '2026-01-01')).toBeUndefined()
    for (const anthropometryContext of ['pregnancy', 'altered-composition'] as const) {
      const s = anthropometricSummary({ ...patient, anthropometryContext }, [measurement], '2026-03-01')
      expect(s.bmi).toBe(25); expect(s.category).toBeUndefined(); expect(s.range).toBeUndefined(); expect(s.ratioCategory).toBeUndefined()
    }
  })
  it('classifies waist/height only with a co-measured BMI below 35 and within the specified range', () => {
    expect(anthropometricSummary(patient, [measurement], '2026-03-01').ratioCategory).toBe('Adiposità centrale aumentata')
    expect(anthropometricSummary(patient, [{ ...measurement, circumferencesCm: { waist: 108 } }], '2026-03-01').ratioCategory).toBe('Adiposità centrale elevata')
    expect(anthropometricSummary(patient, [{ ...measurement, weightKg: 120 }], '2026-03-01').ratioInterpretable).toBe(false)
    expect(anthropometricSummary(patient, [{ ...measurement, circumferencesCm: { waist: 60 } }], '2026-03-01').ratioInterpretable).toBe(false)
  })
  it('derives the chart baseline once and respects patient ownership', () => {
    expect(measurementsWithBaseline(patient, [])).toHaveLength(1)
    expect(measurementsWithBaseline(patient, [{ ...measurement, date: '2026-01-01', weightKg: 90, circumferencesCm: { waist: 99 } }])).toHaveLength(1)
    expect(measurementsWithBaseline(patient, [{ ...measurement, patientId: 'foreign' }])[0].id).toBe('baseline-patient')
  })
  it('rejects invalid baseline dates, dimensions and dates before birth', () => {
    expect(() => validatePatientAnthropometry({ ...patient, initialAssessment: { ...patient.initialAssessment!, date: '9999-01-01' } })).toThrow()
    expect(() => validatePatientAnthropometry({ ...patient, initialAssessment: { ...patient.initialAssessment!, date: '1970-01-01' } })).toThrow()
    expect(() => validatePatientAnthropometry({ ...patient, initialAssessment: { ...patient.initialAssessment!, heightCm: 0 } })).toThrow()
    expect(() => validatePatientAnthropometry({ ...patient, initialAssessment: { ...patient.initialAssessment!, waistCm: -1 } })).toThrow()
  })
})
