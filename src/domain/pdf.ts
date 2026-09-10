import { jsPDF } from 'jspdf'
import { autoTable, type RowInput } from 'jspdf-autotable'
import { nutrientsForPortion, validateDiet, variantNutrients, weekdays } from './diet'
import type { Diet, Food, Patient, StudioProfile } from './models'

const clean = (value: string) => value.replace(/[–—‑]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '')
const number = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 1 })

function header(doc: jsPDF, studio: StudioProfile, draw: boolean) {
  const x = studio.logoDataUrl ? 46 : 16
  let y = 17
  if (draw && studio.logoDataUrl) {
    const dimensions = doc.getImageProperties(studio.logoDataUrl)
    const scale = Math.min(24 / dimensions.width, 24 / dimensions.height)
    doc.addImage(studio.logoDataUrl, studio.logoDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG', 16, 12, dimensions.width * scale, dimensions.height * scale)
  }
  for (const [value, size, leading] of [[studio.name, 15, 6.5], [studio.professional, 10, 4.5], [studio.address, 9, 4], [studio.contact, 9, 4]] as const) {
    if (!value) continue
    doc.setFontSize(size); doc.setTextColor(22, 75, 67)
    const lines = doc.splitTextToSize(clean(value), 194 - x)
    if (draw) doc.text(lines, x, y)
    y += lines.length * leading + 1
  }
  y = Math.max(y, studio.logoDataUrl ? 40 : 30)
  if (draw) { doc.setDrawColor(210, 222, 214); doc.line(16, y, 194, y) }
  return y + 7
}

function finish(doc: jsPDF, studio: StudioProfile, title: string) {
  doc.setProperties({ title: clean(title), author: clean(studio.professional || studio.name), creator: 'GelatoNutriente' })
  const total = doc.getNumberOfPages()
  for (let page = 1; page <= total; page++) {
    doc.setPage(page); header(doc, studio, true)
    doc.setFontSize(8); doc.setTextColor(110, 125, 115)
    const footer = doc.splitTextToSize(clean(studio.footer), 150)
    doc.text(footer, 16, 284 - Math.max(0, footer.length - 1) * 3.5)
    doc.text(`${page} / ${total}`, 194, 289, { align: 'right' })
  }
  return doc
}

export function buildDietPdf(diet: Diet, patientName: string, studio: StudioProfile, mode: 'classic' | 'compact') {
  validateDiet(diet)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const top = header(doc, studio, false)
  const footerHeight = Math.max(22, doc.splitTextToSize(clean(studio.footer), 150).length * 3.5 + 14)
  const intro: RowInput[] = [
    [{ content: clean(diet.name), colSpan: 4, styles: { fontSize: 15, fontStyle: 'bold', fillColor: [236, 244, 238] } }],
    [{ content: clean(`${patientName || 'Piano alimentare'} | Dal ${diet.startsOn}${diet.endsOn ? ` al ${diet.endsOn}` : ''}`), colSpan: 4 }],
  ]
  const dayRows = (day: Diet['days'][number]): RowInput[] => {
    const rows: RowInput[] = [[{ content: weekdays[day.weekday], colSpan: 4, styles: { fontSize: 13, fontStyle: 'bold', fillColor: [22, 75, 67], textColor: 255 } }]]
    for (const variant of day.variants) {
      rows.push([{ content: clean(`${variant.name}${day.variants.length > 1 ? ' - alternativa per tutta la giornata' : ''}`), colSpan: 4, styles: { fontStyle: 'bold', fillColor: [236, 244, 238] } }])
      rows.push(mode === 'compact' ? ['Pasto', { content: 'Alimenti e porzioni', colSpan: 2 }, 'kcal*'] : ['Pasto', 'Alimento e preparazione', 'Quantità', 'kcal'])
      for (const meal of variant.meals) {
        if (mode === 'compact') {
          const ingredients = meal.portions.flatMap(p => [clean(`${p.foodSnapshot.name}: ${number(p.grams)} g (${p.foodSnapshot.preparation})`), ...(p.alternatives ?? []).map(a => clean(`oppure ${a.foodSnapshot.name}: ${number(a.grams)} g (${a.foodSnapshot.preparation})`))]).join('\n')
          rows.push([clean(meal.name), { content: ingredients || 'Non compilato', colSpan: 2 }, number(meal.portions.reduce((total, p) => total + nutrientsForPortion(p).kcal, 0))])
          continue
        }
        if (!meal.portions.length) rows.push([clean(meal.name), 'Non compilato', '-', '-'])
        meal.portions.forEach((p, i) => {
          rows.push([i ? '' : clean(meal.name), clean(`${p.foodSnapshot.name}\n${p.foodSnapshot.preparation}`), `${number(p.grams)} g`, number(nutrientsForPortion(p).kcal)])
          for (const a of p.alternatives ?? []) rows.push(['oppure', clean(`${a.foodSnapshot.name}\n${a.foodSnapshot.preparation}`), `${number(a.grams)} g`, number(nutrientsForPortion(a).kcal)])
        })
      }
      const n = variantNutrients(variant)
      rows.push([{ content: clean(`* Totale alimenti principali - ${variant.name}: ${number(n.kcal)} kcal | Proteine ${number(n.protein)} g | Carboidrati ${number(n.carbs)} g | Grassi ${number(n.fat)} g`), colSpan: 4, styles: { fontStyle: 'bold', fillColor: [245, 247, 244] } }])
    }
    return rows
  }
  const options = { margin: { top, bottom: footerHeight, left: 16, right: 16 }, styles: { font: 'helvetica', fontSize: mode === 'compact' ? 8.5 : 9, cellPadding: mode === 'compact' ? 1.5 : 1.7, textColor: [40, 58, 48] as [number, number, number], overflow: 'linebreak' as const }, columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 105 }, 2: { cellWidth: 22 }, 3: { cellWidth: 21 } }, rowPageBreak: 'avoid' as const }
  if (mode === 'classic') diet.days.forEach((day, index) => { if (index) doc.addPage(); autoTable(doc, { ...options, startY: top, body: [...intro, ...dayRows(day)] }) })
  else {
    let startY = top
    diet.days.forEach((day, index) => {
      autoTable(doc, { ...options, startY, pageBreak: 'avoid', body: [...(index === 0 ? intro : []), ...dayRows(day)] })
      startY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4
    })
  }
  if (diet.notes) autoTable(doc, { ...options, startY: (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5, body: [[{ content: `NOTE DEL PIANO\n${clean(diet.notes)}`, colSpan: 4 }]] })
  return finish(doc, studio, diet.name)
}

export function buildQuestionnairePdf(patient: Patient | undefined, studio: StudioProfile, foods: Food[], filled = false) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' }); const top = header(doc, studio, false)
  const intake = filled ? patient?.intake : undefined
  const foodNames = (ids?: string[]) => (ids ?? []).map(id => foods.find(f => f.id === id)?.name ?? '').filter(Boolean).join(', ')
  const rows: RowInput[] = [
    [{ content: 'Questionario alimentare', styles: { fontSize: 17, fontStyle: 'bold', fillColor: [236, 244, 238] } }],
    [`Nome: ${filled ? clean(patient?.name ?? '') : '________________________________________________________'}`],
    ['Data: ________________________'],
    ...[
      ['Alimenti preferiti', [intake?.preferences, foodNames(intake?.preferredFoodIds)].filter(Boolean).join('\n')],
      ['Alimenti esclusi o non graditi', [intake?.exclusions, foodNames(intake?.excludedFoodIds)].filter(Boolean).join('\n')],
      ['Allergie e intolleranze dichiarate', intake?.allergies],
      ['Giornata alimentare abituale', intake?.habits],
      ['Numero dei pasti, orari, turni e variabilità', intake?.mealsAndSchedule],
      ['Lavoro, movimento quotidiano e attività fisica', intake?.workAndActivity],
      ['Tempo per cucinare, organizzazione e budget', intake?.cookingAndBudget],
      ['Acqua, bibite, caffè e bevande energetiche', intake?.hydration],
      ['Sonno, stress e fame emotiva', intake?.sleepAndStress],
      ['Digestione, alvo e sintomi legati agli alimenti', intake?.digestion],
      ['Diagnosi, condizioni cliniche ed esami recenti', intake?.conditions],
      ['Integratori e prodotti erboristici', intake?.supplements],
      ['Alcol e fumo', intake?.alcoholAndSmoking],
      ['Diete precedenti, risultati e difficoltà', intake?.dietHistory],
    ].map(([title, value]) => [{ content: `${title}\n${value ? clean(value) : '\n________________________________________________________________________\n________________________________________________________________________'}`, styles: { minCellHeight: 21 } }]),
    ['Firma: __________________________________________________________'],
  ]
  autoTable(doc, { startY: top, margin: { top, bottom: Math.max(28, doc.splitTextToSize(clean(studio.footer), 150).length * 3.5 + 14), left: 16, right: 16 }, body: rows, styles: { fontSize: 10, cellPadding: 3.5, lineColor: [221, 228, 220], lineWidth: .1 }, rowPageBreak: 'avoid' })
  return finish(doc, studio, 'Questionario alimentare')
}
