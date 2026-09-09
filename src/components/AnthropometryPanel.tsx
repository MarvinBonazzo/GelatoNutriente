import type { Measurement, Patient } from '../domain/models'
import { anthropometricSummary, anthropometrySource, validatePatientAnthropometry } from '../domain/anthropometry'
import { format } from './NutrientSummary'

const dateLabel = (date?: string) => date ? new Date(`${date}T12:00:00`).toLocaleDateString('it-IT') : 'Data non disponibile'
const signed = (value: number) => `${value > 0 ? '+' : ''}${format(value, 1)}`
export function AnthropometryPanel({ patient, measurements = [] }: { patient: Patient; measurements?: Measurement[] }) {
  try { validatePatientAnthropometry(patient) } catch { return <p className="field-hint">Completa peso, altezza e data della prima visita con valori validi per vedere i calcoli.</p> }
  const s = anthropometricSummary(patient, measurements)
  return <section className="anthropometry" aria-label="Valutazione antropometrica">
    <header><span className="eyebrow">VALUTAZIONE ANTROPOMETRICA</span><h3>Peso, BMI e obiettivo</h3></header>
    <div className="anthropometry-grid">
      <article><span>Peso iniziale</span><strong>{s.baseline ? `${format(s.baseline.weightKg, 1)} kg` : 'Da inserire'}</strong><small>{s.baseline ? `${dateLabel(s.baseline.date)} · ${format(s.baseline.heightCm, 1)} cm` : 'Registra la prima visita nella scheda paziente'}</small></article>
      <article><span>Ultimo peso rilevato</span><strong>{s.weight !== undefined ? `${format(s.weight, 1)} kg` : 'Non rilevato'}</strong><small>{s.date ? dateLabel(s.date) : 'Aggiungi una misurazione'}</small></article>
      <article><span>BMI iniziale → ultimo</span><strong>{s.initialBmi !== undefined ? format(s.initialBmi, 2) : '—'} → {s.bmi !== undefined ? format(s.bmi, 2) : '—'}</strong><small>{s.category ?? (s.weight !== undefined && !s.height ? 'Manca l’altezza della misurazione' : 'kg/m² · classificazione non disponibile')}</small></article>
      <article><span>Variazione dal peso iniziale</span><strong>{s.changeKg !== undefined ? `${signed(s.changeKg)} kg` : '—'}</strong><small>{s.changePercent !== undefined ? `${signed(s.changePercent)}% rispetto alla prima visita` : 'Servono peso iniziale e peso rilevato'}</small></article>
    </div>
    {s.blocked && <p className="field-hint">{s.blocked}</p>}
    <div className="anthropometry-reference">
      <h4>Intervallo di riferimento, non un “BMI ideale” unico</h4>
      {s.range ? <p>Per le soglie standard negli adulti: <strong>18,5 ≤ BMI &lt; 25 kg/m²</strong>. A {format(s.range.height, 1)} cm corrispondono circa <strong>{format(s.range.min, 1)}–{format(s.range.maxExclusive, 1)} kg</strong> (estremo superiore escluso, valori arrotondati).</p> : <p>Inserisci altezza e data di nascita per il confronto con i riferimenti per adulti. Nei contesti clinici specifici l’intervallo automatico resta sospeso.</p>}
      {patient.targetWeight && <p><strong>Obiettivo concordato: {format(patient.targetWeight.kg, 1)} kg</strong>{s.targetBmi !== undefined && ` · BMI corrispondente ${format(s.targetBmi, 2)}`}{s.targetDifference !== undefined && ` · variazione richiesta dall’ultimo peso ${signed(s.targetDifference)} kg`}.</p>}
    </div>
    <div className="anthropometry-reference"><h4>Rapporto vita/altezza (WHtR)</h4>{s.ratio !== undefined ? <><p><strong>{format(s.ratio, 2)}</strong> · vita {format(s.waist!, 1)} cm / altezza {format(s.waistHeight!, 1)} cm · {dateLabel(s.waistDate)}.</p><p>{s.ratioCategory ?? 'Interpretazione automatica non applicata: occorrono un adulto nel contesto standard, peso e altezza della stessa rilevazione con BMI < 35 e rapporto ≥ 0,4.'}</p></> : <p>Registra circonferenza vita e altezza nella stessa visita per calcolarlo.</p>}<small>Soglie di riferimento: 0,4–&lt;0,5; 0,5–&lt;0,6; ≥0,6. Rapporto &lt;0,4 fuori dall’intervallo classificato qui.</small></div>
    <details className="clinical-method"><summary>Metodo e limiti clinici</summary><p>BMI = peso (kg) / altezza² (m). Le classi sono calcolate prima dell’arrotondamento: &lt;18,5; 18,5–&lt;25; 25–&lt;30; 30–&lt;35; 35–&lt;40; ≥40. L’altezza è quella salvata con la rilevazione; le misurazioni precedenti senza altezza richiedono integrazione.</p><p>Il BMI non misura direttamente massa grassa o muscolare. Età, origine familiare, distribuzione del grasso, stato dei fluidi e quadro clinico influenzano l’interpretazione; alcune popolazioni richiedono soglie di rischio inferiori. Questo pannello usa le soglie standard.</p>{s.olderAdult && <p>Dai 65 anni il BMI richiede particolare cautela: considera capacità funzionale, comorbilità e possibile effetto protettivo di un BMI leggermente più alto.</p>}<p>Le categorie indicano un riferimento antropometrico, non una diagnosi autonoma. <a href={anthropometrySource} target="_blank" rel="noreferrer">Metodo e riferimenti NICE NG246</a> · verificati il 9 settembre 2026.</p></details>
  </section>
}
