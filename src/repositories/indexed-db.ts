import Dexie, { type Table } from 'dexie'
import seedFoods from '../data/foods.json'
import { now, validateDiet, validateNutrients } from '../domain/diet'
import { generateShoppingList } from '../domain/shopping'
import type { Appointment, Backup, Diet, Entity, Food, Measurement, Patient, ShoppingList } from '../domain/models'
import type { Repositories, Repository } from './contracts'

export class LocalDatabase extends Dexie {
  patients!: Table<Patient, string>
  diets!: Table<Diet, string>
  foods!: Table<Food, string>
  measurements!: Table<Measurement, string>
  appointments!: Table<Appointment, string>
  shoppingLists!: Table<ShoppingList, string>
  meta!: Table<{ key: string; value: number }, string>

  constructor(name = 'gelatonutriente-v1') {
    super(name)
    this.version(1).stores({
      patients: 'id, name, updatedAt',
      diets: 'id, patientId, status, updatedAt',
      foods: 'id, name, category',
      measurements: 'id, patientId, [patientId+date]',
      appointments: 'id, patientId, startsAt, status',
      shoppingLists: 'id, dietId, patientId',
      meta: 'key',
    })
  }
}

function tableRepository<T extends Entity>(table: Table<T, string>, validate?: (entity: T) => void): Repository<T> {
  return {
    list: () => table.toArray(),
    get: id => table.get(id),
    async save(entity) {
      validate?.(entity)
      const saved = { ...structuredClone(entity), updatedAt: now() }
      await table.put(saved)
      return saved
    },
    async remove(id) { await table.delete(id) },
  }
}

export function createIndexedDbRepositories(db = new LocalDatabase()): Repositories {
  const repositories: Repositories = {
    patients: tableRepository(db.patients, patient => { if (!patient.name.trim()) throw new Error('Inserisci il nome del paziente.') }),
    diets: { ...tableRepository(db.diets), save: diet => repositories.saveDiet(diet) },
    foods: tableRepository(db.foods, food => {
      if (!food.name.trim() || !food.preparation.trim()) throw new Error('Inserisci nome e stato dell’alimento.')
      validateNutrients(food.per100g)
    }),
    measurements: tableRepository(db.measurements),
    appointments: tableRepository(db.appointments),
    shoppingLists: { ...tableRepository(db.shoppingLists), save: list => repositories.saveShoppingList(list) },
    async initialize() {
      await db.transaction('rw', db.foods, db.meta, async () => {
        if (!(await db.meta.get('seed-foods-v1'))) {
          await db.foods.bulkPut(seedFoods as Food[])
          await db.meta.put({ key: 'seed-foods-v1', value: 1 })
        }
      })
    },
    async saveDiet(diet) {
      validateDiet(diet)
      return db.transaction('rw', db.diets, db.patients, async () => {
        const existing = await db.diets.get(diet.id)
        if ((existing?.revision ?? 0) !== diet.revision) throw new Error('Questo piano è stato modificato in un’altra scheda. Ricarica la pagina prima di riprovare; conserva prima le tue modifiche.')
        const patient = diet.patientId ? await db.patients.get(diet.patientId) : undefined
        if (diet.patientId && !patient) throw new Error('Il paziente selezionato non è più disponibile.')
        // Clear any previous assignment to this diet before saving its new state.
        const linkedPatients = await db.patients.toArray()
        for (const linked of linkedPatients) {
          if (linked.assignedDietId === diet.id) {
            await db.patients.put({ ...linked, assignedDietId: undefined, updatedAt: now() })
          }
        }
        if (diet.status === 'assigned' && patient) {
          if (patient.assignedDietId && patient.assignedDietId !== diet.id) {
            const previous = await db.diets.get(patient.assignedDietId)
            if (previous) await db.diets.put({ ...previous, status: 'draft', revision: previous.revision + 1, updatedAt: now() })
          }
          await db.patients.put({ ...patient, assignedDietId: diet.id, updatedAt: now() })
        }
        const saved: Diet = { ...structuredClone(diet), name: diet.name.trim(), revision: diet.revision + 1, updatedAt: now() }
        await db.diets.put(saved)
        return saved
      })
    },
    async saveShoppingList(list) {
      return db.transaction('rw', db.shoppingLists, db.diets, async () => {
        const diet = await db.diets.get(list.dietId)
        if (!diet || diet.revision !== list.dietRevision) throw new Error('Il piano è cambiato. Aggiorna la lista prima di salvarla.')
        if (!list.generationId || list.patientId !== diet.patientId) throw new Error('I riferimenti della lista non sono validi.')
        const items = generateShoppingList(diet, list.from, list.to, list.variantByDate)
        if (!items.length) throw new Error('Non ci sono alimenti nell’intervallo selezionato.')
        if (list.checkedFoodIds.some(id => !items.some(item => item.foodId === id))) throw new Error('Una spunta si riferisce a un alimento non presente nella lista.')
        const existing = await db.shoppingLists.where('dietId').equals(diet.id).first()
        // One current list per diet, even when two tabs generate the first list concurrently.
        const saved = { ...structuredClone(list), id: existing?.id ?? list.id, createdAt: existing?.createdAt ?? list.createdAt, checkedFoodIds: [...new Set(list.checkedFoodIds)], updatedAt: now() }
        await db.shoppingLists.put(saved)
        return saved
      })
    },
    async setShoppingItemChecked(listId, generationId, foodId, checked) {
      return db.transaction('rw', db.shoppingLists, db.diets, async () => {
        const list = await db.shoppingLists.get(listId)
        if (!list || list.generationId !== generationId) throw new Error('La lista è stata rigenerata in un’altra scheda. La pagina verrà aggiornata: riprova sulla nuova lista.')
        const diet = await db.diets.get(list.dietId)
        if (!diet || diet.revision !== list.dietRevision) throw new Error('Il piano è cambiato. Rigenera la lista prima di spuntare gli alimenti.')
        const items = generateShoppingList(diet, list.from, list.to, list.variantByDate)
        if (!items.some(item => item.foodId === foodId)) throw new Error('L’alimento non è più presente nella lista.')
        const ids = new Set(list.checkedFoodIds)
        if (checked) ids.add(foodId)
        else ids.delete(foodId)
        const saved = { ...list, checkedFoodIds: [...ids], updatedAt: now() }
        await db.shoppingLists.put(saved)
        return saved
      })
    },
    async exportBackup(): Promise<Backup> {
      return db.transaction('r', [db.patients, db.diets, db.foods, db.measurements, db.appointments, db.shoppingLists], async () => ({
        format: 'gelatonutriente', schemaVersion: 1, exportedAt: now(),
        patients: await db.patients.toArray(), diets: await db.diets.toArray(), foods: await db.foods.toArray(),
        measurements: await db.measurements.toArray(), appointments: await db.appointments.toArray(), shoppingLists: await db.shoppingLists.toArray(),
      }))
    },
  }
  return repositories
}
