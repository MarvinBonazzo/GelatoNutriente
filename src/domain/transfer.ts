import { validatePatientAnthropometry } from './anthropometry'
import { z } from 'zod'
import { id, isLocalDate, now, validateDiet, validateNutrients } from './diet'
import { validateAppointment } from './calendar'
import { validateMeasurement } from './clinical'
import type { Backup, Diet, Food } from './models'

const identifier = z.string().min(1).max(150).refine(s => !/[\u0000-\u001f\u007f]/.test(s) && !['__proto__', 'constructor', 'prototype'].includes(s))
const text = z.string().max(20000)
const date = z.string().refine(isLocalDate)
const instant = z.string().refine(s => Number.isFinite(Date.parse(s)))
const entity = { id: identifier, createdAt: instant, updatedAt: instant }
const nutrients = z.object({ kcal: z.number().min(0).max(1000), protein: z.number().min(0).max(100), carbs: z.number().min(0).max(100), fat: z.number().min(0).max(100) })
const category = z.enum(['Cereali', 'Proteine', 'Latticini', 'Legumi', 'Verdura', 'Frutta', 'Grassi e frutta secca', 'Altro'])
const snapshot = { name: text, per100g: nutrients, preparation: text, category, source: text }
const food = z.object({ ...entity, ...snapshot, isCustom: z.boolean() })
const portionBase = z.object({ id: identifier, foodId: identifier, grams: z.number().positive().max(10000), foodSnapshot: z.object(snapshot) })
const portion = portionBase.extend({ alternatives: z.array(portionBase).optional() })
const meal = z.object({ id: identifier, name: text, time: text.optional(), portions: z.array(portion) })
const variant = z.object({ id: identifier, name: text, meals: z.array(meal) })
const day = z.object({ id: identifier, weekday: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]), defaultVariantId: identifier, variants: z.array(variant).min(1) })
const dietSchema = z.object({ ...entity, schemaVersion: z.literal(1), revision: z.number().int().nonnegative(), name: text, patientId: identifier.optional(), status: z.enum(['draft', 'assigned']), startsOn: date, endsOn: date.optional(), notes: text, days: z.array(day).length(7), patientVisible: z.boolean().optional(), assignedAt: instant.optional() })
export const patientSchema = z.object({
  ...entity, name: text.min(1), goals: text, notes: text, assignedDietId: identifier.optional(), birthDate: date.optional(), heightCm: z.number().min(50).max(250).optional(), sexForFormula: z.enum(['female', 'male']).optional(),
  initialAssessment: z.object({ date, weightKg: z.number().positive().max(1000), heightCm: z.number().min(50).max(250), waistCm: z.number().positive().max(1000).optional() }).optional(),
  anthropometryContext: z.enum(['standard', 'pregnancy', 'altered-composition']).optional(),
  targetWeight: z.object({ kg: z.number().positive().max(1000), method: z.enum(['manual', 'devine', 'robinson', 'miller', 'bmi']), confirmedAt: instant }).optional(),
  intake: z.object({ preferences: text, exclusions: text, allergies: text, habits: text, preferredFoodIds: z.array(identifier), excludedFoodIds: z.array(identifier) }).optional(),
  medications: z.array(z.object({ id: identifier, activeIngredient: text, product: text, notes: text, active: z.boolean() })).optional(),
})
const positive = z.number().positive().max(1000).optional()
const measurement = z.object({ ...entity, patientId: identifier, date, weightKg: positive, heightCm: z.number().min(50).max(250).optional(), circumferencesCm: z.object({ waist: positive, hips: positive, chest: positive, arm: positive, thigh: positive }), notes: text, enteredBy: z.enum(['nutritionist', 'patient']) })
const appointment = z.object({ ...entity, patientId: identifier, title: text, startsAt: instant, durationMinutes: z.number().int(), timeZone: text, location: text, notes: text, status: z.enum(['scheduled', 'completed', 'cancelled']), reminderMinutesBefore: z.number().int(), reminderAcknowledgedAt: instant.optional() })
const shopping = z.object({ ...entity, generationId: identifier, dietId: identifier, dietRevision: z.number().int().nonnegative(), patientId: identifier.optional(), from: date, to: date, variantByDate: z.record(date, identifier), checkedFoodIds: z.array(identifier), portionChoices: z.record(date, z.record(identifier, identifier)).optional() })
export const studioSchema = z.object({ id: z.literal('studio'), name: z.string().min(1).max(150), professional: z.string().max(150), address: z.string().max(500), contact: z.string().max(300), footer: z.string().max(500), logoDataUrl: z.string().max(1500000).regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/).optional() })
const backupSchema = z.object({ format: z.literal('gelatonutriente'), schemaVersion: z.literal(1), exportedAt: instant, patients: z.array(patientSchema), diets: z.array(dietSchema), foods: z.array(food), measurements: z.array(measurement), appointments: z.array(appointment), shoppingLists: z.array(shopping), studio: studioSchema.optional() })

export function parseBackup(input: unknown): Backup {
  const parsed = backupSchema.safeParse(input)
  if (!parsed.success) throw new Error('Archivio non valido o versione non supportata. Nessun dato è stato modificato.')
  const b = parsed.data
  for (const rows of [b.patients, b.diets, b.foods, b.measurements, b.appointments, b.shoppingLists]) if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('L’archivio contiene identificatori duplicati.')
  const patientIds = new Set(b.patients.map(p => p.id)); const dietIds = new Set(b.diets.map(d => d.id))
  for (const d of b.diets) { validateDiet(d); if (d.patientId && !patientIds.has(d.patientId)) throw new Error('Paziente di un piano non presente nell’archivio.') }
  for (const d of b.diets) if (d.status === 'assigned' && !b.patients.some(p => p.id === d.patientId && p.assignedDietId === d.id)) throw new Error('Piano assegnato senza collegamento coerente al paziente.')
  b.patients.forEach(validatePatientAnthropometry)
  for (const p of b.patients) if (p.assignedDietId && !b.diets.some(d => d.id === p.assignedDietId && d.patientId === p.id && d.status === 'assigned')) throw new Error('Assegnazione del paziente non valida.')
  for (const m of b.measurements) { validateMeasurement(m); if (!patientIds.has(m.patientId)) throw new Error('Paziente della misurazione non presente.') }
  for (const a of b.appointments) { validateAppointment(a); if (!patientIds.has(a.patientId)) throw new Error('Paziente dell’appuntamento non presente.') }
  for (const s of b.shoppingLists) if (!dietIds.has(s.dietId) || (s.patientId && !patientIds.has(s.patientId))) throw new Error('Riferimento della lista della spesa non valido.')
  b.foods.forEach(f => validateNutrients(f.per100g))
  return b
}

export function sharedPlan(diet: Diet) {
  // Only diet content; no patient record, measurements, medications or studio private data.
  const copy = structuredClone(diet)
  delete copy.patientId; delete copy.assignedAt
  copy.status = 'draft'; copy.patientVisible = false; copy.revision = 0
  return { format: 'gelatonutriente-plan' as const, schemaVersion: 1 as const, diet: copy }
}
export function parseSharedPlan(input: unknown): Diet {
  const parsed = z.object({ format: z.literal('gelatonutriente-plan'), schemaVersion: z.literal(1), diet: dietSchema }).safeParse(input)
  if (!parsed.success) throw new Error('File dieta non valido o non supportato.')
  validateDiet(parsed.data.diet)
  return parsed.data.diet
}

export function cloneImportedPlan(input: Diet) {
  const diet = structuredClone(input); diet.id = id(); diet.revision = 0; diet.createdAt = now(); diet.updatedAt = now(); diet.status = 'draft'; diet.patientVisible = false; delete diet.patientId; delete diet.assignedAt
  const foods = new Map<string, Food>()
  for (const day of diet.days) {
    day.id = id()
    for (const variant of day.variants) {
      const previousId = variant.id; variant.id = id(); if (day.defaultVariantId === previousId) day.defaultVariantId = variant.id
      for (const meal of variant.meals) {
        meal.id = id()
        for (const portion of meal.portions.flatMap(p => [p, ...(p.alternatives ?? [])])) {
          portion.id = id()
          const key = `${portion.foodId}:${JSON.stringify(portion.foodSnapshot)}`
          if (!foods.has(key)) foods.set(key, { ...portion.foodSnapshot, id: id(), createdAt: now(), updatedAt: now(), isCustom: true })
          portion.foodId = foods.get(key)!.id
        }
      }
    }
  }
  return { diet, foods: [...foods.values()] }
}

const base64 = (bytes: Uint8Array) => { let result = ''; for (const byte of bytes) result += String.fromCharCode(byte); return btoa(result) }
const unbase64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0))
async function keyFor(password: string, salt: Uint8Array<ArrayBuffer>) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, key, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
export async function encryptTransfer(data: unknown, password: string) {
  if (password.length < 10) throw new Error('Usa una password di almeno 10 caratteri.')
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFor(password, salt), new TextEncoder().encode(JSON.stringify(data)))
  return JSON.stringify({ format: 'gelatonutriente-encrypted', version: 1, salt: base64(salt), iv: base64(iv), payload: base64(new Uint8Array(encrypted)) })
}
export async function decodeTransfer(raw: string, password: string): Promise<unknown> {
  if (new TextEncoder().encode(raw).length > 25 * 1024 * 1024) throw new Error('Il file supera il limite di importazione di 25 MB.')
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new Error('Il file non contiene JSON valido.') }
  if (!value || typeof value !== 'object' || !('format' in value) || value.format !== 'gelatonutriente-encrypted') return value
  try {
    const envelope = z.object({ format: z.literal('gelatonutriente-encrypted'), version: z.literal(1), salt: z.string(), iv: z.string(), payload: z.string() }).parse(value)
    const salt = unbase64(envelope.salt); const iv = unbase64(envelope.iv)
    if (salt.length !== 16 || iv.length !== 12) throw new Error()
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await keyFor(password, salt), unbase64(envelope.payload))
    return JSON.parse(new TextDecoder().decode(plain))
  } catch { throw new Error('Password errata oppure file cifrato danneggiato. Nessun dato è stato modificato.') }
}
