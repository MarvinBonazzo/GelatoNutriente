import type { Nutrients } from '../domain/models'

export const format = (value: number, decimals = 0) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: decimals }).format(value)

export function NutrientSummary({ nutrients, compact = false }: { nutrients: Nutrients; compact?: boolean }) {
  const totalEnergy = nutrients.protein * 4 + nutrients.carbs * 4 + nutrients.fat * 9
  return <div className={`nutrients ${compact ? 'compact' : ''}`}>
    {!compact && <div className="nutrient-heading"><span>Totale della giornata</span><span className="eyebrow">VARIANTE ATTIVA</span></div>}
    <div className="nutrient-values">
      <div className="energy"><strong>{format(nutrients.kcal)}</strong><span>kcal</span></div>
      <div><span className="macro-label"><i className="dot protein" />Proteine</span><strong>{format(nutrients.protein, 1)} <small>g</small></strong></div>
      <div><span className="macro-label"><i className="dot carbs" />Carboidrati</span><strong>{format(nutrients.carbs, 1)} <small>g</small></strong></div>
      <div><span className="macro-label"><i className="dot fat" />Grassi</span><strong>{format(nutrients.fat, 1)} <small>g</small></strong></div>
    </div>
    {!compact && <div className="macro-bar" aria-label="Ripartizione energetica dei macronutrienti">
      <span className="protein" style={{ width: `${totalEnergy ? nutrients.protein * 4 / totalEnergy * 100 : 0}%` }} />
      <span className="carbs" style={{ width: `${totalEnergy ? nutrients.carbs * 4 / totalEnergy * 100 : 0}%` }} />
      <span className="fat" style={{ width: `${totalEnergy ? nutrients.fat * 9 / totalEnergy * 100 : 0}%` }} />
    </div>}
  </div>
}
