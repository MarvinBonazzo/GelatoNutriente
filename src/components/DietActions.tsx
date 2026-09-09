import { useState } from 'react'
import { Download, FileText, Share2 } from 'lucide-react'
import type { Diet } from '../domain/models'
import { useAppStore } from '../store/app-store'
import { encryptTransfer, sharedPlan } from '../domain/transfer'
import { downloadFile } from '../app/download'
import { Modal } from './Modal'

export function DietActions({ diet }: { diet: Diet }) {
  const { studio, patients } = useAppStore()
  const [mode, setMode] = useState<'pdf' | 'share' | null>(null)
  const [layout, setLayout] = useState<'classic' | 'compact'>('classic')
  const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  async function exportFile() {
    setBusy(true); setError('')
    try {
      if (mode === 'pdf') {
        const { buildDietPdf } = await import('../domain/pdf')
        buildDietPdf(diet, patients.find(p => p.id === diet.patientId)?.name ?? '', studio, layout).save('GelatoNutriente-dieta.pdf')
      } else downloadFile(await encryptTransfer(sharedPlan(diet), password), 'GelatoNutriente-dieta.gndiet')
      setMode(null); setPassword('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Esportazione non riuscita.') } finally { setBusy(false) }
  }
  return <><div className="diet-document-actions"><button className="button secondary" onClick={() => { setError(''); setMode('pdf') }}><FileText size={16} />PDF dieta</button><button className="button secondary" onClick={() => { setError(''); setMode('share') }}><Share2 size={16} />Condividi file</button></div>
    {mode && <Modal title={mode === 'pdf' ? 'Esporta dieta in PDF' : 'Condividi una copia della dieta'} onClose={() => setMode(null)}><form className="form-stack" onSubmit={e => { e.preventDefault(); void exportFile() }}>
      {mode === 'pdf' ? <><label>Formato<select value={layout} onChange={e => setLayout(e.target.value as typeof layout)}><option value="classic">Classico · ogni giorno inizia su un foglio</option><option value="compact">Compatto · più giorni per foglio</option></select></label><p className="field-hint">Include tutti i menu e le varianti. Giorni molto lunghi proseguono sul foglio successivo, senza tagliare il contenuto. Logo e intestazione si modificano in “Studio e file”.</p></> : <><p>Il file include titolo, note del piano, giorni, varianti e alimenti. Non include l’anagrafica, le note private, i farmaci o le misurazioni del paziente.</p><label>Password del file<input type="password" minLength={10} required autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label><p className="field-hint">Almeno 10 caratteri. Comunica la password al destinatario separatamente; non viene salvata e non può essere recuperata. La copia importata sarà indipendente dall’originale.</p></>}
      {error && <p className="error" role="alert">{error}</p>}<button className="button" disabled={busy}><Download size={17} />{busy ? 'Preparazione…' : 'Scarica file'}</button>
    </form></Modal>}
  </>
}
