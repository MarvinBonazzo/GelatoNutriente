import { describe, expect, it } from 'vitest'
import seedFoods from '../data/foods.json'
import type { Food } from './models'
import { cloneVariant, createDiet, createPortion } from './diet'
import { createShoppingRecord, defaultShoppingRange, generateShoppingList, shoppingDays } from './shopping'

const pasta = (seedFoods as Food[]).find(f => f.name === 'Pasta di semola')!
function plan() {
  const diet = createDiet(); diet.startsOn = '2026-03-01'
  for (const day of diet.days) day.variants[0].meals[0].portions = [createPortion(pasta, 80)]
  return diet
}

describe('lista della spesa su calendario', () => {
  it('aggrega un intervallo inclusivo attraverso domenica e lunedì', () => {
    const result = generateShoppingList(plan(), '2026-03-08', '2026-03-09')
    expect(result).toHaveLength(1)
    expect(result[0].grams).toBe(160)
  })
  it('ripete lo schema settimanale su due settimane', () => {
    expect(generateShoppingList(plan(), '2026-03-02', '2026-03-15')[0].grams).toBe(1120)
  })
  it('sostituisce la variante principale con quella scelta, senza sommarle', () => {
    const diet = plan()
    const alternative = cloneVariant(diet.days[0].variants[0], 'Opzione 2')
    alternative.meals[0].portions[0].grams = 40
    diet.days[0].variants.push(alternative)
    expect(generateShoppingList(diet, '2026-03-02', '2026-03-02', { '2026-03-02': alternative.id })[0].grams).toBe(40)
    expect(generateShoppingList(diet, '2026-03-02', '2026-03-02')[0].grams).toBe(80)
  })
  it('non perde giorni nel passaggio all’ora legale', () => {
    expect(generateShoppingList(plan(), '2026-03-28', '2026-03-30')[0].grams).toBe(240)
  })
  it('rifiuta date fuori dal piano, range inversi e alternative sconosciute', () => {
    expect(() => generateShoppingList(plan(), '2026-02-28', '2026-03-02')).toThrow()
    expect(() => generateShoppingList(plan(), '2026-03-05', '2026-03-02')).toThrow()
    expect(() => generateShoppingList(plan(), '2026-03-02', '2026-03-02', { '2026-03-02': 'missing' })).toThrow('Variante')
  })
  it('consente alternative diverse per lo stesso giorno di settimane differenti', () => {
    const diet = plan()
    const alternative = cloneVariant(diet.days[0].variants[0], 'Opzione 2')
    alternative.meals[0].portions[0].grams = 40
    diet.days[0].variants.push(alternative)
    expect(generateShoppingList(diet, '2026-03-02', '2026-03-09', { '2026-03-09': alternative.id })[0].grams).toBe(600)
  })
  it('sceglie un intervallo predefinito entro l’inizio e la fine del piano', () => {
    const diet = plan(); diet.endsOn = '2026-03-05'
    expect(defaultShoppingRange(diet, '2026-02-25')).toEqual({ from: '2026-03-01', to: '2026-03-05' })
    expect(defaultShoppingRange(diet, '2026-03-04')).toEqual({ from: '2026-03-04', to: '2026-03-05' })
    expect(defaultShoppingRange(diet, '2026-04-01')).toEqual({ from: '2026-03-01', to: '2026-03-05' })
  })
  it('fissa una scelta esplicita per ogni data e rimuove scelte fuori intervallo', () => {
    const diet = plan()
    const record = createShoppingRecord(diet, '2026-03-02', '2026-03-03', { '2026-03-01': 'ignored' })
    expect(Object.keys(record.variantByDate)).toEqual(['2026-03-02', '2026-03-03'])
    expect(record.variantByDate['2026-03-02']).toBe(diet.days[0].defaultVariantId)
  })
  it('rigenera la stessa lista con nuova generazione e tutte le spunte azzerate', () => {
    const diet = plan()
    const original = createShoppingRecord(diet, '2026-03-02', '2026-03-03', {})
    original.checkedFoodIds = [pasta.id]
    const regenerated = createShoppingRecord(diet, '2026-03-02', '2026-03-03', {}, original)
    expect(regenerated.id).toBe(original.id)
    expect(regenerated.createdAt).toBe(original.createdAt)
    expect(regenerated.generationId).not.toBe(original.generationId)
    expect(regenerated.checkedFoodIds).toEqual([])
  })
  it('rifiuta una lista senza ingredienti e range oltre 366 giorni', () => {
    const diet = createDiet(); diet.startsOn = '2026-03-01'
    expect(() => createShoppingRecord(diet, '2026-03-02', '2026-03-03', {})).toThrow('alimenti')
    expect(() => shoppingDays(diet, '2026-03-01', '2027-03-02')).toThrow('366')
  })
})
