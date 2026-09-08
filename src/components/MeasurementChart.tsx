import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Measurement } from '../domain/models'

/** Ready for the next measurement module; missing observations remain gaps. */
export function MeasurementChart({ measurements, metric = 'weightKg' }: { measurements: Measurement[]; metric?: 'weightKg' | 'waist' | 'hips' | 'chest' | 'arm' | 'thigh' }) {
  const unit = metric === 'weightKg' ? 'kg' : 'cm'
  const data = [...measurements].sort((a, b) => a.date.localeCompare(b.date)).map(m => ({ date: m.date, value: metric === 'weightKg' ? m.weightKg : m.circumferencesCm[metric] }))
  if (!data.some(point => point.value !== undefined)) return <div className="empty-panel">Aggiungi una misurazione per vedere l’andamento.</div>
  return <div aria-label={`Andamento delle misurazioni in ${unit}`}>
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 20, right: 20, bottom: 10, left: 0 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickFormatter={date => new Date(`${date}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} />
        <YAxis unit={` ${unit}`} domain={['auto', 'auto']} width={65} />
        <Tooltip />
        <Line name={unit} type="linear" dataKey="value" stroke="#16705b" strokeWidth={2.5} connectNulls={false} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
    <details><summary>Dati del grafico</summary><ul>{data.map((point, i) => <li key={`${point.date}-${i}`}>{point.date}: {point.value ?? 'Non rilevato'} {point.value !== undefined ? unit : ''}</li>)}</ul></details>
  </div>
}
