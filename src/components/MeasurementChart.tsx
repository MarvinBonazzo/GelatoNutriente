import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { bodyMassIndex } from '../domain/anthropometry'
import type { Measurement } from '../domain/models'

/** Missing observations remain gaps; the table provides an accessible alternative. */
export function MeasurementChart({ measurements, metric = 'weightKg' }: { measurements: Measurement[]; metric?: 'weightKg' | 'bmi' | 'waist' | 'hips' | 'chest' | 'arm' | 'thigh' }) {
  const unit = metric === 'bmi' ? 'kg/m²' : metric === 'weightKg' ? 'kg' : 'cm'
  const data = [...measurements].sort((a, b) => a.date.localeCompare(b.date)).map(m => ({ date: m.date, value: metric === 'bmi' ? m.weightKg && m.heightCm ? bodyMassIndex(m.weightKg, m.heightCm) : undefined : metric === 'weightKg' ? m.weightKg : m.circumferencesCm[metric] }))
  if (!data.some(point => point.value !== undefined)) return <div className="empty-panel">Aggiungi una misurazione per vedere l’andamento.</div>
  return <div aria-label={`Andamento delle misurazioni in ${unit}`}>
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 20, right: 20, bottom: 10, left: 0 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickFormatter={date => new Date(`${date}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} />
        <YAxis unit={` ${unit}`} domain={['auto', 'auto']} width={65} />
        <Tooltip formatter={value => typeof value === 'number' ? value.toLocaleString('it-IT', { maximumFractionDigits: 2 }) : value} />
        <Line name={unit} type="linear" dataKey="value" stroke="#16705b" strokeWidth={2.5} connectNulls={false} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
    <details><summary>Dati del grafico</summary><ul>{data.map((point, i) => <li key={`${point.date}-${i}`}>{point.date}: {point.value === undefined ? 'Non rilevato' : point.value.toLocaleString('it-IT', { maximumFractionDigits: 2 })} {point.value !== undefined ? unit : ''}</li>)}</ul></details>
  </div>
}
