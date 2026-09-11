import type { Nutrients } from '../domain/models'
import { macroEnergyPercentages } from '../domain/diet'

export const format = (value: number, decimals = 0) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: decimals }).format(value)

export function NutrientSummary({ nutrients, compact = false, targetKcal, macroTargets }: { nutrients: Nutrients; compact?: boolean; targetKcal?: number; macroTargets?: { carbsPercent: number; proteinPercent: number; fatPercent: number } }) {
  const percentages = macroEnergyPercentages(nutrients)
  const kcalProgress = targetKcal ? nutrients.kcal / targetKcal * 100 : undefined
  const kcalDelta = targetKcal ? nutrients.kcal - targetKcal : undefined
  return <div className={`nutrients ${compact ? 'compact' : ''}`}>
    {!compact && <div className="nutrient-heading"><span>Totale della giornata</span><span className="eyebrow">VARIANTE ATTIVA</span></div>}
    <div className="daily-energy-summary" aria-label="Confronto tra energia effettiva e obiettivo">
      <div><span>Kcal effettive</span><strong>{format(nutrients.kcal)} <small>kcal</small></strong></div>
      <div><span>Target kcal</span><strong>{targetKcal ? format(targetKcal) : '—'} <small>{targetKcal ? 'kcal' : 'non definito'}</small></strong></div>
      <div><span>% del target</span><strong>{kcalProgress !== undefined ? `${format(kcalProgress)}%` : '—'}</strong>{kcalDelta !== undefined && <small>Scarto {kcalDelta > 0 ? '+' : ''}{format(kcalDelta)} kcal</small>}</div>
    </div>
    <div className="nutrient-values macro-values">
      <div><span className="macro-label"><i className="dot protein" />Proteine</span><strong>{format(nutrients.protein, 1)} <small>g</small></strong><small className="macro-percent">Effettive {format(percentages.protein, 1)}% kcal{macroTargets && ` · target ${format(macroTargets.proteinPercent)}%`}</small></div>
      <div><span className="macro-label"><i className="dot carbs" />Carboidrati</span><strong>{format(nutrients.carbs, 1)} <small>g</small></strong><small className="macro-percent">Effettivi {format(percentages.carbs, 1)}% kcal{macroTargets && ` · target ${format(macroTargets.carbsPercent)}%`}</small></div>
      <div><span className="macro-label"><i className="dot fat" />Grassi</span><strong>{format(nutrients.fat, 1)} <small>g</small></strong><small className="macro-percent">Effettivi {format(percentages.fat, 1)}% kcal{macroTargets && ` · target ${format(macroTargets.fatPercent)}%`}</small></div>
    </div>
    {!compact && <div className="macro-bar" aria-label="Ripartizione energetica dei macronutrienti">
      <span className="protein" style={{ width: `${percentages.protein}%` }} />
      <span className="carbs" style={{ width: `${percentages.carbs}%` }} />
      <span className="fat" style={{ width: `${percentages.fat}%` }} />
    </div>}
    {!compact && targetKcal && macroTargets && <div className="macro-target-caption">Obiettivi indicativi a {format(targetKcal)} kcal: carboidrati {format(targetKcal * macroTargets.carbsPercent / 400, 1)} g · proteine {format(targetKcal * macroTargets.proteinPercent / 400, 1)} g · grassi {format(targetKcal * macroTargets.fatPercent / 900, 1)} g</div>}
  </div>
}
