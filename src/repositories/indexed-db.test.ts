import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { id, now, sampleDiet } from '../domain/diet'
import { createShoppingRecord, generateShoppingList } from '../domain/shopping'
import type { Patient } from '../domain/models'
import { createIndexedDbRepositories, LocalDatabase } from './indexed-db'

let db: LocalDatabase
let repo: ReturnType<typeof createIndexedDbRepositories>
beforeEach(async () => {
  db = new LocalDatabase(`test-${id()}`)
  repo = createIndexedDbRepositories(db)
  await repo.initialize()
})
afterEach(async () => { await db.delete() })
const patient = (name = 'Paziente test'): Patient => ({ id: id(), name, goals: '', notes: '', createdAt: now(), updatedAt: now() })

describe('repository IndexedDB', () => {
  it('inizializza solo alimenti, senza pazienti dimostrativi e senza duplicazioni', async () => {
    expect(await repo.patients.list()).toEqual([])
    const foods = await repo.foods.list()
    expect(foods).toHaveLength(72)
    await repo.initialize()
    expect(await repo.foods.list()).toHaveLength(72)
  })
  it('conserva dati e alimenti personalizzati alla riapertura del database', async () => {
    const person = await repo.patients.save(patient())
    const food = { ...(await repo.foods.list())[0], id: id(), name: 'Alimento test', isCustom: true }
    await repo.foods.save(food)
    const databaseName = db.name
    db.close()
    db = new LocalDatabase(databaseName); repo = createIndexedDbRepositories(db)
    await repo.initialize()
    expect((await repo.patients.get(person.id))?.name).toBe('Paziente test')
    expect(await repo.foods.list()).toHaveLength(73)
  })
  it('salva piano e assegnazione in un’unica transazione', async () => {
    const person = await repo.patients.save(patient())
    const diet = sampleDiet(await repo.foods.list())
    diet.patientId = person.id; diet.status = 'assigned'
    const saved = await repo.saveDiet(diet)
    expect(saved.revision).toBe(1)
    expect((await repo.patients.get(person.id))?.assignedDietId).toBe(diet.id)
    expect((await repo.diets.get(diet.id))?.status).toBe('assigned')
  })
  it('mantiene un solo piano attivo e aggiorna le revisioni dei piani precedenti', async () => {
    const person = await repo.patients.save(patient())
    const first = sampleDiet(await repo.foods.list()); first.patientId = person.id; first.status = 'assigned'
    await repo.saveDiet(first)
    const second = sampleDiet(await repo.foods.list()); second.patientId = person.id; second.status = 'assigned'
    await repo.saveDiet(second)
    expect((await repo.diets.get(first.id))?.status).toBe('draft')
    expect((await repo.diets.get(first.id))?.revision).toBe(2)
    expect((await repo.patients.get(person.id))?.assignedDietId).toBe(second.id)
  })
  it('rimuove il collegamento del vecchio paziente quando il piano viene riassegnato', async () => {
    const a = await repo.patients.save(patient('Test A'))
    const b = await repo.patients.save(patient('Test B'))
    const diet = sampleDiet(await repo.foods.list()); diet.patientId = a.id; diet.status = 'assigned'
    const saved = await repo.saveDiet(diet)
    await repo.saveDiet({ ...saved, patientId: b.id })
    expect((await repo.patients.get(a.id))?.assignedDietId).toBeUndefined()
    expect((await repo.patients.get(b.id))?.assignedDietId).toBe(saved.id)
  })
  it('rifiuta un salvataggio obsoleto senza sovrascrivere un piano più recente', async () => {
    const original = sampleDiet(await repo.foods.list())
    await repo.saveDiet(original)
    await expect(repo.saveDiet({ ...original, name: 'Da altra scheda' })).rejects.toThrow('altra scheda')
    expect((await repo.diets.get(original.id))?.name).toBe(original.name)
  })
  it('non salva un piano collegato a un paziente inesistente', async () => {
    const diet = sampleDiet(await repo.foods.list()); diet.patientId = 'missing'; diet.status = 'assigned'
    await expect(repo.saveDiet(diet)).rejects.toThrow('paziente')
    expect(await repo.diets.get(diet.id)).toBeUndefined()
  })
  it('esporta uno snapshot JSON con formato e versione', async () => {
    await repo.patients.save(patient())
    const exported = JSON.parse(JSON.stringify(await repo.exportBackup()))
    expect(exported.format).toBe('gelatonutriente')
    expect(exported.schemaVersion).toBe(1)
    expect(exported.patients).toHaveLength(1)
    expect(exported.foods).toHaveLength(72)
    expect(exported.appointments).toEqual([])
  })
})

async function savedShoppingList() {
  const sample = sampleDiet(await repo.foods.list()); sample.startsOn = '2026-09-07'
  const diet = await repo.saveDiet(sample)
  const list = await repo.saveShoppingList(createShoppingRecord(diet, '2026-09-07', '2026-09-13', {}))
  const items = generateShoppingList(diet, list.from, list.to, list.variantByDate)
  return { diet, list, items }
}

describe('persistenza lista della spesa', () => {
  it('mantiene una sola lista corrente anche generandola da due schede', async () => {
    const { diet, list } = await savedShoppingList()
    const another = await repo.saveShoppingList(createShoppingRecord(diet, list.from, list.to, {}))
    expect(another.id).toBe(list.id)
    expect(another.generationId).not.toBe(list.generationId)
    expect(await repo.shoppingLists.list()).toHaveLength(1)
  })
  it('conserva intervallo, alternative e spunte alla riapertura', async () => {
    const { list, items } = await savedShoppingList()
    await repo.setShoppingItemChecked(list.id, list.generationId, items[0].foodId, true)
    const databaseName = db.name; db.close()
    db = new LocalDatabase(databaseName); repo = createIndexedDbRepositories(db)
    const read = await repo.shoppingLists.get(list.id)
    expect(read?.from).toBe('2026-09-07')
    expect(Object.keys(read!.variantByDate)).toHaveLength(7)
    expect(read?.checkedFoodIds).toEqual([items[0].foodId])
  })
  it('salva spunte concorrenti su alimenti diversi senza perdere aggiornamenti', async () => {
    const { list, items } = await savedShoppingList()
    await Promise.all([
      repo.setShoppingItemChecked(list.id, list.generationId, items[0].foodId, true),
      repo.setShoppingItemChecked(list.id, list.generationId, items[1].foodId, true),
    ])
    expect((await repo.shoppingLists.get(list.id))?.checkedFoodIds.sort()).toEqual([items[0].foodId, items[1].foodId].sort())
  })
  it('rimuove una spunta senza alterare le altre', async () => {
    const { list, items } = await savedShoppingList()
    await repo.setShoppingItemChecked(list.id, list.generationId, items[0].foodId, true)
    await repo.setShoppingItemChecked(list.id, list.generationId, items[1].foodId, true)
    await repo.setShoppingItemChecked(list.id, list.generationId, items[0].foodId, false)
    expect((await repo.shoppingLists.get(list.id))?.checkedFoodIds).toEqual([items[1].foodId])
  })
  it('blocca spunte se il piano è cambiato, senza alterare la vecchia lista', async () => {
    const { diet, list, items } = await savedShoppingList()
    await repo.saveDiet({ ...diet, notes: 'Piano aggiornato' })
    await expect(repo.setShoppingItemChecked(list.id, list.generationId, items[0].foodId, true)).rejects.toThrow('piano è cambiato')
    expect((await repo.shoppingLists.get(list.id))?.checkedFoodIds).toEqual([])
    await expect(repo.saveShoppingList(list)).rejects.toThrow('piano è cambiato')
  })
  it('blocca una spunta tardiva su una generazione precedente', async () => {
    const { diet, list, items } = await savedShoppingList()
    const regenerated = await repo.saveShoppingList(createShoppingRecord(diet, list.from, list.to, {}, list))
    await expect(repo.setShoppingItemChecked(list.id, list.generationId, items[0].foodId, true)).rejects.toThrow('rigenerata')
    await repo.setShoppingItemChecked(regenerated.id, regenerated.generationId, items[0].foodId, true)
    expect((await repo.shoppingLists.get(list.id))?.checkedFoodIds).toEqual([items[0].foodId])
  })
  it('rifiuta alimenti non presenti nella lista e riferimenti errati al paziente', async () => {
    const { list } = await savedShoppingList()
    await expect(repo.setShoppingItemChecked(list.id, list.generationId, 'missing', true)).rejects.toThrow('alimento')
    await expect(repo.saveShoppingList({ ...list, patientId: 'missing' })).rejects.toThrow('riferimenti')
  })
  it('include le spunte nell’esportazione dell’archivio', async () => {
    const { list, items } = await savedShoppingList()
    await repo.setShoppingItemChecked(list.id, list.generationId, items[0].foodId, true)
    const exported = await repo.exportBackup()
    expect(exported.shoppingLists[0].generationId).toBe(list.generationId)
    expect(exported.shoppingLists[0].checkedFoodIds).toEqual([items[0].foodId])
  })
})
