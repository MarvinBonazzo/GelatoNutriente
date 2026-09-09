import type { Appointment, Backup, Diet, Entity, Food, Measurement, Patient, ShoppingList, StudioProfile } from '../domain/models'

export interface Repository<T extends Entity> {
  list(): Promise<T[]>
  get(id: string): Promise<T | undefined>
  save(entity: T): Promise<T>
  remove(id: string): Promise<void>
}

export interface Repositories {
  patients: Repository<Patient>
  diets: Repository<Diet>
  foods: Repository<Food>
  measurements: Repository<Measurement>
  appointments: Repository<Appointment>
  shoppingLists: Repository<ShoppingList>
  initialize(): Promise<void>
  /** Atomically save diet + assignment, including the previous patient's link. */
  saveDiet(diet: Diet): Promise<Diet>
  saveShoppingList(list: ShoppingList): Promise<ShoppingList>
  setShoppingItemChecked(listId: string, generationId: string, foodId: string, checked: boolean): Promise<ShoppingList>
  exportBackup(): Promise<Backup>
  restoreBackup(backup: unknown): Promise<void>
  getStudio(): Promise<StudioProfile>
  saveStudio(profile: StudioProfile): Promise<void>
  importDiet(diet: Diet, patient?: Patient | string): Promise<Diet>
}
