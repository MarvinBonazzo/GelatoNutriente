import { describe, expect, it } from 'vitest'
import seedFoods from '../data/foods.json'
import type { Food } from './models'
import { cloneVariant, createDiet, createPortion, isLocalDate, sampleDiet, totalNutrients, validateDiet, validateNutrients, variantNutrients } from './diet'

const foods = seedFoods as Food[]
const pasta = foods.find(f => f.name === 'Pasta di semola')!
const oil = foods.find(f => f.name === 'Olio extravergine di oliva')!

describe('calcoli nutrizionali', () => {
  it('applica i grammi / 100 senza arrotondare i singoli ingredienti', () => {
    const result = totalNutrients([createPortion(pasta, 80), createPortion(oil, 10)])
    expect(result.kcal).toBeCloseTo(372.3)
    expect(result.protein).toBeCloseTo(10.4)
    expect(result.carbs).toBeCloseTo(56.8)
    expect(result.fat).toBeCloseTo(11.19)
  })
  it('calcola un totale zero per un pasto vuoto', () => {
    expect(totalNutrients([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 })
  })
  it('mantiene immutabile lo snapshot del cibo inserito', () => {
    const food = structuredClone(pasta)
    const portion = createPortion(food, 100)
    food.per100g.kcal = 1
    expect(totalNutrients([portion]).kcal).toBe(353)
  })
  it('non somma le varianti alternative', () => {
    const diet = createDiet()
    const a = diet.days[0].variants[0]
    a.meals[0].portions = [createPortion(pasta, 100)]
    const b = cloneVariant(a, 'Alternativa')
    b.meals[0].portions = [createPortion(oil, 10)]
    diet.days[0].variants.push(b)
    expect(variantNutrients(a).kcal).toBe(353)
    expect(variantNutrients(b).kcal).toBeCloseTo(89.9)
  })
})

describe('struttura del piano e validazione', () => {
  it('crea sette giorni indipendenti, ciascuno con cinque pasti', () => {
    const diet = createDiet()
    expect(diet.days.map(d => d.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(diet.days.every(d => d.variants[0].meals.length === 5)).toBe(true)
    validateDiet(diet)
  })
  it('duplica pasti e porzioni con nuovi id e senza riferimenti condivisi', () => {
    const source = sampleDiet(foods).days[0].variants[0]
    const copy = cloneVariant(source, 'Opzione 2')
    expect(copy.id).not.toBe(source.id)
    expect(copy.meals[0].id).not.toBe(source.meals[0].id)
    expect(copy.meals[0].portions[0].id).not.toBe(source.meals[0].portions[0].id)
    copy.meals[0].portions[0].grams = 5
    expect(source.meals[0].portions[0].grams).toBe(40)
  })
  it.each([0, -1, NaN, Infinity, 10001])('rifiuta porzioni non valide: %s', grams => {
    const diet = sampleDiet(foods)
    diet.days[0].variants[0].meals[0].portions[0].grams = grams
    expect(() => validateDiet(diet)).toThrow('porzioni')
  })
  it('non consente l’assegnazione senza paziente e senza alimenti', () => {
    const diet = createDiet(); diet.status = 'assigned'
    expect(() => validateDiet(diet)).toThrow('paziente')
    diet.patientId = 'patient'
    expect(() => validateDiet(diet)).toThrow('alimento')
  })
  it('rifiuta varianti principali inesistenti e giorni duplicati', () => {
    const diet = createDiet(); diet.days[0].defaultVariantId = 'missing'
    expect(() => validateDiet(diet)).toThrow('predefinita')
    diet.days[0].defaultVariantId = diet.days[0].variants[0].id
    diet.days[1].weekday = 0
    expect(() => validateDiet(diet)).toThrow('sette giorni')
  })
  it('rifiuta date impossibili e fine antecedente all’inizio', () => {
    expect(isLocalDate('2026-02-30')).toBe(false)
    expect(isLocalDate('2028-02-29')).toBe(true)
    const diet = createDiet(); diet.startsOn = '2026-09-08'; diet.endsOn = '2026-09-07'
    expect(() => validateDiet(diet)).toThrow('date')
  })
  it('include 50–100 alimenti, tutti validi e con fonte e preparazione', () => {
    expect(foods.length).toBeGreaterThanOrEqual(50)
    expect(foods.length).toBeLessThanOrEqual(100)
    expect(new Set(foods.map(f => f.id)).size).toBe(foods.length)
    for (const food of foods) {
      validateNutrients(food.per100g)
      expect(food.source.length).toBeGreaterThan(0)
      expect(food.preparation.length).toBeGreaterThan(0)
    }
  })
  it('rifiuta valori nutrizionali negativi e non numerici', () => {
    expect(() => validateNutrients({ kcal: -1, protein: 0, carbs: 0, fat: 0 })).toThrow()
    expect(() => validateNutrients({ kcal: NaN, protein: 0, carbs: 0, fat: 0 })).toThrow()
  })
})
