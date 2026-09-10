import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Dexie from 'dexie'
import { createIndexedDbRepositories, LocalDatabase } from './indexed-db'
import { createPortion, id, now, sampleDiet } from '../domain/diet'
import { patientDiets } from '../domain/clinical'
import { createShoppingRecord } from '../domain/shopping'
import type { Patient } from '../domain/models'
import seedFoods from '../data/foods.json'
import { extraFoods } from '../data/extra-foods'
let db: LocalDatabase
let repo: ReturnType<typeof createIndexedDbRepositories>
const person = (): Patient => ({ id: id(), createdAt: now(), updatedAt: now(), name: 'Profilo test', notes: '', goals: '' })
const defaultFoodCount = seedFoods.length + extraFoods.length
beforeEach(async () => { db = new LocalDatabase(`transfer-${id()}`); repo = createIndexedDbRepositories(db); await repo.initialize() })
afterEach(async () => { vi.restoreAllMocks(); await db.delete() })
it('round-trips a complete archive including studio, measurements, medicines, appointments and shopping choices', async () => {
  const patient = await repo.patients.save({ ...person(), medications: [{ id: id(), activeIngredient: 'olanzapina', product: '', notes: '', active: true }] })
  await repo.measurements.save({ id: id(), createdAt: now(), updatedAt: now(), patientId: patient.id, date: '2026-01-01', circumferencesCm: { waist: 80 }, enteredBy: 'patient', notes: '' })
  await repo.appointments.save({ id: id(), createdAt: now(), updatedAt: now(), patientId: patient.id, startsAt: '2026-10-01T10:00:00Z', timeZone: 'Europe/Rome', title: 'Controllo', durationMinutes: 30, reminderMinutesBefore: 60, status: 'scheduled', location: '', notes: '' })
  const draft = sampleDiet(await repo.foods.list()); draft.patientId = patient.id; draft.status = 'assigned'; draft.startsOn = '2026-09-07'
  const portion = draft.days[0].variants[0].meals[0].portions[0]
  const alternative = createPortion((await repo.foods.list())[20], 130); portion.alternatives = [alternative]
  const diet = await repo.saveDiet(draft)
  const list = await repo.saveShoppingList(createShoppingRecord(diet, '2026-09-07', '2026-09-07', {}, undefined, { '2026-09-07': { [portion.id]: alternative.id } }))
  await repo.setShoppingItemChecked(list.id, list.generationId, alternative.foodId, true)
  await repo.saveStudio({ ...(await repo.getStudio()), name: 'Studio test' })
  const backup = JSON.parse(JSON.stringify(await repo.exportBackup()))
  await repo.restoreBackup(backup)
  const restored = await repo.exportBackup()
  expect(restored.patients).toEqual(backup.patients)
  expect(restored.diets).toEqual(backup.diets)
  expect(restored.measurements).toEqual(backup.measurements)
  expect(restored.appointments).toEqual(backup.appointments)
  expect(restored.shoppingLists).toEqual(backup.shoppingLists)
  expect(restored.studio?.name).toBe('Studio test')
})
it('rejects malformed and dangling-reference backups before changing the current archive', async () => {
  const patient = await repo.patients.save(person())
  const backup = await repo.exportBackup()
  await expect(repo.restoreBackup({ ...backup, schemaVersion: 999 })).rejects.toThrow()
  await expect(repo.restoreBackup({ ...backup, patients: [{ ...patient, assignedDietId: 'missing' }] })).rejects.toThrow()
  await expect(repo.restoreBackup({ ...backup, patients: [patient, patient] })).rejects.toThrow()
  expect(await repo.patients.list()).toEqual([patient])
  expect(await repo.foods.list()).toHaveLength(defaultFoodCount)
})
it('rolls back a failed restore after tables have been cleared', async () => {
  const patient = await repo.patients.save(person())
  const backup = await repo.exportBackup()
  vi.spyOn(db.foods, 'bulkPut').mockRejectedValueOnce(new Error('Simulated storage failure'))
  await expect(repo.restoreBackup({ ...backup, patients: [] })).rejects.toThrow('storage failure')
  expect(await repo.patients.list()).toEqual([patient])
  expect(await repo.foods.list()).toHaveLength(defaultFoodCount)
})
it('imports independent plans and preserves previously assigned patient-visible history', async () => {
  const patient = await repo.patients.save(person())
  const draft = sampleDiet(await repo.foods.list())
  const first = await repo.importDiet(draft, patient.id)
  const second = await repo.importDiet(draft, patient.id)
  expect(second.id).not.toBe(first.id)
  expect((await repo.patients.get(patient.id))?.assignedDietId).toBe(second.id)
  expect(patientDiets(await repo.diets.list(), patient.id)).toHaveLength(2)
  const old = await repo.diets.get(first.id)
  expect(old?.patientVisible).toBe(true)
  expect(old?.status).toBe('draft')
})
it('does not leave foods or diets behind when import assignment fails', async () => {
  await expect(repo.importDiet(sampleDiet(await repo.foods.list()), 'missing')).rejects.toThrow()
  expect(await repo.diets.list()).toHaveLength(0)
  expect(await repo.foods.list()).toHaveLength(defaultFoodCount)
})
it('rejects measurements and appointments with missing patients', async () => {
  await expect(repo.measurements.save({ id: id(), createdAt: now(), updatedAt: now(), patientId: 'missing', date: '2026-01-01', weightKg: 70, circumferencesCm: {}, notes: '', enteredBy: 'patient' })).rejects.toThrow('Paziente')
  await expect(repo.appointments.save({ id: id(), createdAt: now(), updatedAt: now(), patientId: 'missing', title: 'Controllo', startsAt: '2026-10-01T12:00:00Z', durationMinutes: 30, timeZone: 'Europe/Rome', reminderMinutesBefore: 60, location: '', notes: '', status: 'scheduled' })).rejects.toThrow('Paziente')
})
it('migrates an existing v1 database without losing assigned plans or clinical records', async () => {
  const name = `migration-${id()}`
  const old = new Dexie(name)
  old.version(1).stores({ patients: 'id, name, updatedAt', diets: 'id, patientId, status, updatedAt', foods: 'id, name, category', measurements: 'id, patientId, [patientId+date]', appointments: 'id, patientId, startsAt, status', shoppingLists: 'id, dietId, patientId', meta: 'key' })
  const patient = person(); const diet = sampleDiet(await repo.foods.list()); diet.patientId = patient.id; diet.status = 'assigned'; patient.assignedDietId = diet.id
  await old.table('patients').put(patient); await old.table('diets').put(diet); old.close()
  const upgraded = new LocalDatabase(name)
  try {
    expect((await upgraded.diets.get(diet.id))?.patientVisible).toBe(true)
    expect((await upgraded.diets.get(diet.id))?.days).toEqual(diet.days)
    expect(await upgraded.patients.get(patient.id)).toEqual(patient)
    expect(await upgraded.studio.toArray()).toEqual([])
  } finally { await upgraded.delete() }
})
it('preserves baseline and measurement heights through save, reopen and backup restore', async () => {
  const original = { ...person(), birthDate: '1980-01-01', heightCm: 180, initialAssessment: { date: '2026-01-01', weightKg: 90, heightCm: 180, waistCm: 99 }, anthropometryContext: 'standard' as const }
  const saved = await repo.patients.save(original)
  const measure = await repo.measurements.save({ id: id(), createdAt: now(), updatedAt: now(), patientId: saved.id, date: '2026-02-01', weightKg: 81, heightCm: 180, circumferencesCm: { waist: 90 }, notes: '', enteredBy: 'nutritionist' })
  const backup = await repo.exportBackup()
  const name = db.name; db.close(); db = new LocalDatabase(name); repo = createIndexedDbRepositories(db)
  expect((await repo.patients.get(saved.id))?.initialAssessment).toEqual(original.initialAssessment)
  await repo.restoreBackup(JSON.parse(JSON.stringify(backup)))
  expect((await repo.measurements.get(measure.id))?.heightCm).toBe(180)
  expect((await repo.patients.get(saved.id))?.initialAssessment).toEqual(original.initialAssessment)
  await expect(repo.patients.save({ ...saved, initialAssessment: { ...original.initialAssessment, weightKg: -1 } })).rejects.toThrow()
  await expect(repo.restoreBackup({ ...backup, patients: [{ ...saved, initialAssessment: { ...original.initialAssessment, date: '9999-01-01' } }] })).rejects.toThrow()
  expect((await repo.patients.get(saved.id))?.initialAssessment).toEqual(original.initialAssessment)
})
