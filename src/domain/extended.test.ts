import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import seed from '../data/foods.json'
import { addYears, ageOnDate, estimateEnergyNeeds, patientDiets, recentMeasurements, referenceWeight, validateMeasurement } from './clinical'
import { appointmentIcs, dueAppointments, validateAppointment } from './calendar'
import { cloneImportedPlan, decodeTransfer, encryptTransfer, parseSharedPlan, sharedPlan } from './transfer'
import { createDiet, createPortion, cloneVariant, id, now, variantNutrients } from './diet'
import { generateDietDraft } from './generator'
import { generateShoppingList } from './shopping'
import { buildDietPdf, buildQuestionnairePdf } from './pdf'
import { findMedicationEffect } from '../data/medication-effects'
import type { Appointment, Food, Measurement, Patient, StudioProfile } from './models'
const foods = seed as Food[]
const person: Patient = { id: 'person', createdAt: now(), updatedAt: now(), name: 'Profilo di prova', notes: 'NOTE PRIVATE', goals: '', birthDate: '1980-01-01', heightCm: 177.8, sexForFormula: 'male' }
const appointment: Appointment = { id: 'event', createdAt: now(), updatedAt: '2026-09-08T12:00:00Z', patientId: person.id, title: 'Controllo', startsAt: '2026-10-25T01:30:00Z', timeZone: 'Europe/Rome', durationMinutes: 30, reminderMinutesBefore: 60, location: 'Studio', notes: 'NOTE PRIVATE', status: 'scheduled' }
const measurement: Measurement = { id: id(), createdAt: now(), updatedAt: now(), patientId: person.id, date: '2026-01-01', weightKg: 70, circumferencesCm: {}, notes: '', enteredBy: 'patient' }
function planWithAlternative() {
  const diet = createDiet(); diet.startsOn = '2026-09-07'
  const portion = createPortion(foods[0], 80); portion.alternatives = [createPortion(foods[1], 120)]
  diet.days[0].variants[0].meals[0].portions = [portion]
  return { diet, portion, alt: portion.alternatives[0] }
}
describe('clinical reference and archive windows', () => {
  it('stima metabolismo a riposo e mantenimento usando peso recente e PAL', () => {
    const profile = { ...person, initialAssessment: { date: '2026-01-01', weightKg: 70, heightCm: 177.8 }, energyProfile: { activityLevel: 'moderate' as const, goal: 'maintain' as const } }
    const result = estimateEnergyNeeds(profile, [{ ...measurement, weightKg: 75, heightCm: 177.8 }, { ...measurement, id: 'foreign', patientId: 'other', date: '2026-09-01', weightKg: 200 }], '2026-09-10')
    expect(result.age).toBe(46)
    expect(result.weightKg).toBe(75)
    expect(result.restingKcal).toBeCloseTo(1636.25)
    expect(result.maintenanceKcal).toBeCloseTo(2618)
    expect(ageOnDate('1980-09-11', '2026-09-10')).toBe(45)
  })
  it('sospende la stima energetica con dati mancanti, minori e contesti specifici', () => {
    const complete = { ...person, initialAssessment: { date: '2026-01-01', weightKg: 70, heightCm: 177.8 }, energyProfile: { activityLevel: 'low' as const, goal: 'maintain' as const } }
    expect(() => estimateEnergyNeeds({ ...complete, birthDate: undefined })).toThrow('nascita')
    expect(() => estimateEnergyNeeds({ ...complete, birthDate: '2010-01-01' }, [], '2026-09-10')).toThrow('19 anni')
    expect(() => estimateEnergyNeeds({ ...complete, anthropometryContext: 'pregnancy' })).toThrow('gravidanza')
    expect(() => estimateEnergyNeeds({ ...complete, energyProfile: undefined })).toThrow('attività')
  })
  it('calculates published reference equations for ten inches above five feet', () => {
    expect(referenceWeight(person, 'devine')).toBeCloseTo(73)
    expect(referenceWeight(person, 'robinson')).toBeCloseTo(71)
    expect(referenceWeight(person, 'miller')).toBeCloseTo(70.3)
    expect(referenceWeight({ ...person, sexForFormula: 'female' }, 'miller')).toBeCloseTo(66.7)
    expect(referenceWeight(person, 'bmi', 22)).toBeCloseTo(69.547448)
  })
  it('refuses missing age, children, missing formula sex and extrapolation under five feet', () => {
    expect(() => referenceWeight({ ...person, birthDate: undefined }, 'devine')).toThrow()
    expect(() => referenceWeight({ ...person, birthDate: '2020-01-01' }, 'devine')).toThrow()
    expect(() => referenceWeight({ ...person, sexForFormula: undefined }, 'devine')).toThrow()
    expect(() => referenceWeight({ ...person, heightCm: 150 }, 'devine')).toThrow()
  })
  it('clamps leap days and applies inclusive visibility without deleting archives', () => {
    expect(addYears('2024-02-29', 1)).toBe('2025-02-28')
    const diet = { ...createDiet(), patientId: person.id, patientVisible: true, startsOn: '2024-02-01', endsOn: '2024-02-29' }
    expect(patientDiets([diet], person.id, '2025-02-28')).toHaveLength(1)
    expect(patientDiets([diet], person.id, '2025-03-01')).toHaveLength(0)
    expect(diet.patientVisible).toBe(true)
    expect(recentMeasurements([{ ...measurement, date: '2024-02-28' }, { ...measurement, date: '2024-02-29' }, { ...measurement, date: '2026-03-01' }], '2026-02-28')).toHaveLength(2)
  })
  it('rejects empty, impossible and future measurements but permits circumference-only records', () => {
    expect(() => validateMeasurement({ ...measurement, weightKg: undefined })).toThrow()
    expect(() => validateMeasurement({ ...measurement, weightKg: NaN })).toThrow()
    expect(() => validateMeasurement({ ...measurement, date: '9999-01-01' })).toThrow()
    expect(() => validateMeasurement({ ...measurement, weightKg: undefined, circumferencesCm: { waist: 80 } })).not.toThrow()
  })
  it('does not interpret an uncovered medicine as no risk', () => {
    expect(findMedicationEffect('  OLANZAPINA  ')).toBeDefined()
    expect(findMedicationEffect('olanzapina e altro')).toBeUndefined()
    expect(findMedicationEffect('farmaco sconosciuto')).toBeUndefined()
  })
})
describe('calendar and reminders', () => {
  it('preserves UTC through DST, excludes private notes and includes a calendar alarm', () => {
    const ics = appointmentIcs(appointment)
    expect(ics).toContain('DTSTART:20261025T013000Z')
    expect(ics).toContain('DTEND:20261025T020000Z')
    expect(ics).toContain('TRIGGER:-PT60M')
    expect(ics).not.toContain('NOTE PRIVATE')
  })
  it('escapes injected lines and folds UTF-8 without breaking characters', () => {
    const ics = appointmentIcs({ ...appointment, id: 'x\nBEGIN:VEVENT', title: 'è'.repeat(90) + '\nLOCATION:fake;room,1' })
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(ics).not.toContain('\r\nLOCATION:fake')
    expect(ics.split('\r\n').every(line => new TextEncoder().encode(line).length <= 75)).toBe(true)
    expect(ics.replace(/\r\n /g, '')).toContain('è'.repeat(90) + '\\nLOCATION:fake\\;room\\,1')
  })
  it('only alerts within the reminder window and excludes acknowledged or cancelled events', () => {
    const start = Date.parse(appointment.startsAt)
    expect(dueAppointments([appointment], start - 3600001)).toHaveLength(0)
    expect(dueAppointments([appointment], start - 3600000)).toHaveLength(1)
    expect(dueAppointments([appointment], start + 1)).toHaveLength(0)
    expect(dueAppointments([{ ...appointment, reminderAcknowledgedAt: now() }, { ...appointment, status: 'cancelled' }], start)).toHaveLength(0)
    expect(appointmentIcs({ ...appointment, status: 'cancelled' })).not.toContain('BEGIN:VALARM')
  })
  it('rejects invalid durations and time zones', () => {
    expect(() => validateAppointment({ ...appointment, durationMinutes: -1 })).toThrow()
    expect(() => validateAppointment({ ...appointment, timeZone: 'invalid' })).toThrow()
  })
})
describe('generated plans and ingredient alternatives', () => {
  it.each(['fixed', 'multiple'] as const)('generates %s weekly drafts with clinician-defined energy and independent variants', mode => {
    const draft = generateDietDraft(createDiet(), foods, person, 1800, mode)
    expect(draft.status).toBe('draft'); expect(draft.patientVisible).toBe(false)
    for (const day of draft.days) {
      expect(day.variants).toHaveLength(mode === 'fixed' ? 1 : 2)
      for (const variant of day.variants) expect(Math.abs(variantNutrients(variant).kcal - 1800)).toBeLessThan(2)
    }
  })
  it('honors explicit exclusions and fails without changing the input if a required group is unavailable', () => {
    const excluded = foods.find(f => f.name === 'Mela')!
    const patient = { ...person, intake: { preferences: '', exclusions: '', allergies: '', habits: '', preferredFoodIds: [], excludedFoodIds: [excluded.id] } }
    const draft = generateDietDraft(createDiet(), foods, patient, 1800, 'multiple')
    expect(JSON.stringify(draft)).not.toContain(`"foodId":"${excluded.id}"`)
    const original = createDiet(); const copy = structuredClone(original)
    expect(() => generateDietDraft(original, foods.filter(f => f.name !== 'Olio extravergine di oliva'), person, 1800, 'fixed')).toThrow('Nessun alimento')
    expect(original).toEqual(copy)
  })
  it('counts only the selected replacement on each date and rejects unknown alternatives', () => {
    const { diet, portion, alt } = planWithAlternative()
    const selected = generateShoppingList(diet, '2026-09-07', '2026-09-14', {}, { '2026-09-07': { [portion.id]: alt.id } })
    expect(selected.find(i => i.foodId === portion.foodId)?.grams).toBe(80)
    expect(selected.find(i => i.foodId === alt.foodId)?.grams).toBe(120)
    expect(() => generateShoppingList(diet, '2026-09-07', '2026-09-07', {}, { '2026-09-07': { [portion.id]: 'missing' } })).toThrow('Alternativa')
    expect(cloneVariant(diet.days[0].variants[0], 'copy').meals[0].portions[0].alternatives?.[0].id).not.toBe(alt.id)
  })
})
describe('portable plan files', () => {
  it('shares content without patient identifiers and imports fresh nested IDs and snapshots', () => {
    const { diet, portion, alt } = planWithAlternative()
    const shared = sharedPlan({ ...diet, patientId: person.id, status: 'assigned', assignedAt: now() })
    const parsed = parseSharedPlan(shared)
    expect(parsed.patientId).toBeUndefined(); expect(parsed.assignedAt).toBeUndefined()
    const imported = cloneImportedPlan(parsed)
    const copied = imported.diet.days[0].variants[0].meals[0].portions[0]
    expect(copied.id).not.toBe(portion.id); expect(copied.alternatives?.[0].id).not.toBe(alt.id)
    expect(copied.foodId).not.toBe(portion.foodId)
    expect(imported.foods).toHaveLength(2)
    expect(copied.foodSnapshot).toEqual(portion.foodSnapshot)
  })
  it('round-trips authenticated encryption, rejects wrong passwords and reads legacy JSON', async () => {
    const shared = sharedPlan(planWithAlternative().diet)
    const encoded = await encryptTransfer(shared, 'password-test-123')
    expect(encoded).not.toContain(shared.diet.name)
    expect(await decodeTransfer(encoded, 'password-test-123')).toEqual(shared)
    await expect(decodeTransfer(encoded, 'password-errata')).rejects.toThrow('Password errata')
    const tampered = JSON.parse(encoded); tampered.payload = (tampered.payload[0] === 'A' ? 'B' : 'A') + tampered.payload.slice(1)
    await expect(decodeTransfer(JSON.stringify(tampered), 'password-test-123')).rejects.toThrow()
    expect(await decodeTransfer(JSON.stringify(shared), '')).toEqual(shared)
    await expect(encryptTransfer(shared, 'short')).rejects.toThrow()
  })
})
it('exports all seven days and questionnaire as printable PDFs', () => {
  const draft = generateDietDraft(createDiet(), foods, person, 1800, 'fixed')
  draft.name = 'Piano dimostrativo per verifica PDF'; draft.startsOn = '2026-09-07'; draft.endsOn = '2026-09-13'
  draft.days[0].variants[0].meals[0].portions[0].alternatives = [createPortion(foods[1], 90)]
  const studio: StudioProfile = { id: 'studio', name: 'Studio di nutrizione', professional: 'Professionista dimostrativo', address: 'Via di esempio 10 · Roma', contact: 'Contatto di prova', footer: 'Documento sintetico per verifica del layout · GelatoNutriente' }
  const classic = buildDietPdf(draft, person.name, studio, 'classic')
  const compact = buildDietPdf(draft, person.name, studio, 'compact')
  const questionnaire = buildQuestionnairePdf(undefined, studio, foods)
  expect(classic.getNumberOfPages()).toBe(7)
  expect(compact.getNumberOfPages()).toBeLessThan(7)
  expect(questionnaire.getNumberOfPages()).toBe(2)
  if (process.env.GENERATE_PDF_FIXTURES === '1') {
    mkdirSync('artifacts/pdf-qa', { recursive: true })
    for (const [name, doc] of [['classico', classic], ['compatto', compact], ['questionario', questionnaire]] as const) writeFileSync(`artifacts/pdf-qa/${name}.pdf`, Buffer.from(doc.output('arraybuffer')))
  }
})
