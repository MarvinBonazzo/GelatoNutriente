import { create } from 'zustand'
import { createDiet } from '../domain/diet'
import type { Appointment, Diet, Food, Measurement, Patient, ShoppingList, StudioProfile } from '../domain/models'
import { repositories } from '../repositories'

interface AppState {
  ready: boolean
  error?: string
  patients: Patient[]
  diets: Diet[]
  foods: Food[]
  shoppingLists: ShoppingList[]
  measurements: Measurement[]
  appointments: Appointment[]
  studio: StudioProfile
  selectedPatientId: string
  selectedPatientDietId: string
  draft: Diet
  dirty: boolean
  notice?: string
  initialize: () => Promise<void>
  refresh: () => Promise<void>
  editDraft: (change: (draft: Diet) => void) => void
  setDraft: (draft: Diet, dirty?: boolean) => void
  saveDraft: (status?: Diet['status']) => Promise<void>
  savePatient: (patient: Patient) => Promise<void>
  saveFood: (food: Food) => Promise<void>
  saveShoppingList: (list: ShoppingList) => Promise<void>
  checkShoppingItem: (listId: string, generationId: string, foodId: string, checked: boolean) => Promise<void>
  selectPatient: (id: string) => void
  selectPatientDiet: (id: string) => void
  notify: (notice?: string) => void
  saveMeasurement: (measurement: Measurement) => Promise<void>
  saveAppointment: (appointment: Appointment) => Promise<void>
  removeMeasurement: (id: string) => Promise<void>
  saveStudio: (studio: StudioProfile) => Promise<void>
}

let initialization: Promise<void> | undefined

export const useAppStore = create<AppState>((set, get) => ({
  ready: false, patients: [], diets: [], foods: [], shoppingLists: [], measurements: [], appointments: [], studio: { id: 'studio', name: 'Studio di nutrizione', professional: '', address: '', contact: '', footer: 'GelatoNutriente' }, selectedPatientId: '', selectedPatientDietId: '', draft: createDiet(), dirty: false,
  async initialize() {
    if (!initialization) {
      initialization = (async () => {
        try {
          await repositories.initialize()
          await get().refresh()
          const latest = [...get().diets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
          set({ ready: true, error: undefined, ...(latest ? { draft: structuredClone(latest) } : {}) })
        } catch {
          initialization = undefined
          set({ error: 'Impossibile aprire l’archivio locale. Verifica che il browser consenta l’uso dello spazio di archiviazione e riprova.' })
        }
      })()
    }
    await initialization
  },
  async refresh() {
    const [patients, diets, foods, shoppingLists, measurements, appointments, studio] = await Promise.all([repositories.patients.list(), repositories.diets.list(), repositories.foods.list(), repositories.shoppingLists.list(), repositories.measurements.list(), repositories.appointments.list(), repositories.getStudio()])
    set({ patients, diets, shoppingLists, measurements, appointments, studio, foods: foods.sort((a, b) => a.name.localeCompare(b.name, 'it')) })
  },
  editDraft(change) {
    const draft = structuredClone(get().draft)
    change(draft)
    set({ draft, dirty: true })
  },
  setDraft(draft, dirty = false) { set({ draft: structuredClone(draft), dirty }) },
  async saveDraft(status) {
    const submittedDraft = get().draft
    const saved = await repositories.saveDiet({ ...submittedDraft, status: status ?? submittedDraft.status })
    // Preserve any changes entered while the asynchronous write was pending.
    if (get().draft === submittedDraft) set({ draft: saved, dirty: false })
    else if (get().draft.id === submittedDraft.id) set({ draft: { ...get().draft, revision: saved.revision, status: saved.status } })
    await get().refresh()
    set({ notice: saved.status === 'assigned' ? 'Piano salvato e assegnato al paziente.' : 'Piano salvato in questo browser.' })
  },
  async savePatient(patient) { await repositories.patients.save(patient); await get().refresh(); set({ notice: 'Paziente salvato.' }) },
  async saveFood(food) { await repositories.foods.save(food); await get().refresh(); set({ notice: 'Alimento aggiunto al catalogo.' }) },
  async saveShoppingList(list) { await repositories.saveShoppingList(list); await get().refresh(); set({ notice: 'Lista della spesa generata e salvata.' }) },
  async checkShoppingItem(listId, generationId, foodId, checked) {
    await repositories.setShoppingItemChecked(listId, generationId, foodId, checked)
    await get().refresh()
  },
  selectPatient(selectedPatientId) { set({ selectedPatientId, selectedPatientDietId: '' }) },
  selectPatientDiet(selectedPatientDietId) { set({ selectedPatientDietId }) },
  notify(notice) { set({ notice }) },
  async saveMeasurement(m) { await repositories.measurements.save(m); await get().refresh(); set({ notice: 'Misurazione salvata.' }) },
  async removeMeasurement(id) { await repositories.measurements.remove(id); await get().refresh(); set({ notice: 'Misurazione eliminata.' }) },
  async saveAppointment(a) { await repositories.appointments.save(a); await get().refresh(); set({ notice: 'Appuntamento salvato.' }) },
  async saveStudio(studio) { await repositories.saveStudio(studio); await get().refresh(); set({ notice: 'Intestazione dello studio salvata.' }) },
}))
