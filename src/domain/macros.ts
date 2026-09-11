import type { Patient } from './models'

export type MacroProfileId = NonNullable<NonNullable<Patient['energyProfile']>['macroProfile']>
export type MacroTargets = NonNullable<NonNullable<Patient['energyProfile']>['macroTargets']>

export const macroProfiles: { id: Exclude<MacroProfileId, 'custom'>; label: string; targets: MacroTargets; rationale: string; source: string }[] = [
  { id: 'general', label: 'Generale · 50 / 20 / 30', targets: { carbsPercent: 50, proteinPercent: 20, fatPercent: 30 }, rationale: 'Punto di partenza generalista, da adattare a fabbisogni, qualità degli alimenti e quadro clinico.', source: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet' },
  { id: 'moderate-carb', label: 'Carboidrati moderati · 45 / 25 / 30', targets: { carbsPercent: 45, proteinPercent: 25, fatPercent: 30 }, rationale: 'Riduce moderatamente la quota glucidica aumentando quella proteica; non implica una dieta low-carb.', source: 'https://www.efsa.europa.eu/sites/default/files/2017_09_DRVs_summary_report.pdf' },
  { id: 'higher-protein', label: 'Proteine aumentate · 40 / 30 / 30', targets: { carbsPercent: 40, proteinPercent: 30, fatPercent: 30 }, rationale: 'Preset operativo a quota proteica maggiore; richiede verifica individuale e non viene scelto automaticamente da diagnosi o obiettivo.', source: 'https://pubmed.ncbi.nlm.nih.gov/28642676/' },
  { id: 'higher-carb', label: 'Carboidrati aumentati · 55 / 20 / 25', targets: { carbsPercent: 55, proteinPercent: 20, fatPercent: 25 }, rationale: 'Punto di partenza per richieste glucidiche maggiori; attività e carichi di allenamento vanno valutati dal professionista.', source: 'https://pubmed.ncbi.nlm.nih.gov/11128862/' },
  { id: 'lower-carb', label: 'Carboidrati ridotti · 35 / 25 / 40', targets: { carbsPercent: 35, proteinPercent: 25, fatPercent: 40 }, rationale: 'Alternativa moderatamente ridotta in carboidrati, fuori dal preset generale: usare soltanto dopo scelta clinica esplicita.', source: 'https://www.efsa.europa.eu/sites/default/files/2022-04/7259.pdf' },
]

export const defaultMacroTargets: MacroTargets = macroProfiles[0].targets

export function validateMacroTargets(targets: MacroTargets) {
  const values = [targets.carbsPercent, targets.proteinPercent, targets.fatPercent]
  if (values.some(value => !Number.isFinite(value) || value < 0 || value > 100) || Math.abs(values.reduce((sum, value) => sum + value, 0) - 100) >= .01) {
    throw new Error('Le percentuali di carboidrati, proteine e grassi devono essere comprese tra 0 e 100 e totalizzare 100%.')
  }
}

export function macroGramTargets(kcal: number, targets: MacroTargets) {
  validateMacroTargets(targets)
  return {
    carbs: kcal * targets.carbsPercent / 400,
    protein: kcal * targets.proteinPercent / 400,
    fat: kcal * targets.fatPercent / 900,
  }
}

export function macroProfileIsModified(profile: MacroProfileId | undefined, targets: MacroTargets | undefined) {
  if (!targets || !profile || profile === 'custom') return false
  const original = macroProfiles.find(item => item.id === profile)?.targets
  return !!original && (original.carbsPercent !== targets.carbsPercent || original.proteinPercent !== targets.proteinPercent || original.fatPercent !== targets.fatPercent)
}
