import { useState, type FormEvent } from 'react'
import { Download, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/app-store'
import { repositories } from '../repositories'
import { decodeTransfer, encryptTransfer, parseBackup, parseSharedPlan } from '../domain/transfer'
import { createDiet, id, now } from '../domain/diet'
import type { Backup, Diet, StudioProfile } from '../domain/models'
import { downloadFile } from '../app/download'

export function Settings() {
  const { studio, saveStudio, patients, diets, dirty, setDraft, refresh, notify, selectPatient } = useAppStore()
  const [profile, setProfile] = useState<StudioProfile>(studio)
  const [exportPassword, setExportPassword] = useState(''); const [importPassword, setImportPassword] = useState('')
  const [file, setFile] = useState<File>(); const [review, setReview] = useState<{ type: 'backup'; value: Backup } | { type: 'plan'; value: Diet }>()
  const [targetPatient, setTargetPatient] = useState(''); const [selfName, setSelfName] = useState('Il mio profilo')
  const [confirmed, setConfirmed] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const navigate = useNavigate()
  async function task(action: () => Promise<void>) { setError(''); setBusy(true); try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Operazione non riuscita.') } finally { setBusy(false) } }
  async function readLogo(file?: File) {
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1000000) throw new Error('Usa un logo PNG o JPEG di massimo 1 MB.')
    const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })
    const image = new Image(); image.src = url
    await image.decode()
    if (image.width > 5000 || image.height > 5000) throw new Error('Il logo deve essere al massimo 5.000 pixel per lato.')
    setProfile(p => ({ ...p, logoDataUrl: url }))
  }
  async function analyze(e: FormEvent) {
    e.preventDefault(); if (!file) return
    setReview(undefined); setConfirmed(false)
    await task(async () => {
      if (file.size > 25 * 1024 * 1024) throw new Error('Il file supera 25 MB.')
      const data = await decodeTransfer(await file.text(), importPassword)
      if (data && typeof data === 'object' && 'format' in data && data.format === 'gelatonutriente') setReview({ type: 'backup', value: parseBackup(data) })
      else setReview({ type: 'plan', value: parseSharedPlan(data) })
    })
  }
  async function apply() {
    await task(async () => {
      if (!review) return
      if (dirty && !window.confirm('Il piano aperto ha modifiche non salvate. Scartarle per importare il file?')) return
      if (review.type === 'backup') {
        if (!confirmed) return
        await repositories.restoreBackup(review.value); await refresh()
        setDraft(review.value.diets[0] ?? createDiet()); setProfile(await repositories.getStudio())
        selectPatient(''); notify('Archivio importato.'); setReview(undefined)
      } else {
        const person = targetPatient === 'new' ? { id: id(), createdAt: now(), updatedAt: now(), name: selfName.trim(), goals: '', notes: '' } : targetPatient || undefined
        const saved = await repositories.importDiet(review.value, person)
        await refresh(); setDraft(saved); selectPatient(saved.patientId ?? ''); notify('Dieta importata come copia indipendente.')
        navigate(saved.patientId ? '/paziente' : '/piani')
      }
      setImportPassword(''); setFile(undefined)
    })
  }
  return <>
    <div className="page-heading"><div><p className="eyebrow">IL TUO SPAZIO, SU MISURA</p><h1>Studio e file<span className="heading-dot">.</span></h1><p>Intestazione dei documenti e trasferimento locale dei dati.</p></div></div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="settings-grid"><section className="panel module-panel"><h2>Logo e intestazione</h2><form className="form-stack" onSubmit={e => { e.preventDefault(); void task(() => saveStudio(profile)) }}>
      {([['name', 'Nome dello studio', 150], ['professional', 'Professionista', 150], ['address', 'Indirizzo', 500], ['contact', 'Contatti', 300], ['footer', 'Piè di pagina', 500]] as const).map(([key, label, maxLength]) => <label key={key}>{label}<input required={key === 'name'} maxLength={maxLength} value={profile[key]} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))} /></label>)}
      <label>Logo PNG / JPEG<input type="file" accept="image/png,image/jpeg" onChange={e => { const f = e.target.files?.[0]; void task(() => readLogo(f)) }} /></label>{profile.logoDataUrl && <div className="logo-preview"><img src={profile.logoDataUrl} alt="Logo dello studio" /><button type="button" className="text-link" onClick={() => setProfile(p => ({ ...p, logoDataUrl: undefined }))}>Rimuovi logo</button></div>}
      <button className="button" disabled={busy}>Salva intestazione</button>
    </form></section>
    <div><section className="panel module-panel"><h2>Porta l’archivio su un altro dispositivo</h2><p className="module-description">Include {patients.length} pazienti, {diets.length} piani, misurazioni, farmaci e appuntamenti. Per condividere solo una dieta usa “Condividi file” nel piano.</p><form className="form-stack" onSubmit={e => { e.preventDefault(); void task(async () => { downloadFile(await encryptTransfer(await repositories.exportBackup(), exportPassword), 'GelatoNutriente-archivio.gnbackup'); setExportPassword(''); notify('Archivio cifrato esportato. Conserva la password separatamente.') }) }}><label>Password dell’archivio<input type="password" required minLength={10} autoComplete="new-password" value={exportPassword} onChange={e => setExportPassword(e.target.value)} /></label><p className="field-hint">Almeno 10 caratteri. La password non viene memorizzata e non è recuperabile.</p><button className="button secondary" disabled={busy}><Download size={17} />Esporta archivio cifrato</button></form></section>
    <section className="panel module-panel"><h2>Importa un file</h2><form className="form-stack" onSubmit={analyze}><label>Archivio o dieta<input type="file" accept=".gnbackup,.gndiet,.json,application/json" required onChange={e => { setFile(e.target.files?.[0]); setReview(undefined); setConfirmed(false) }} /></label><label>Password, se il file è cifrato<input type="password" autoComplete="off" value={importPassword} onChange={e => setImportPassword(e.target.value)} /></label><button className="button secondary" disabled={busy || !file}><Upload size={17} />Analizza file</button></form>
      {review && <div className="import-review">{review.type === 'backup' ? <><h3>Archivio completo</h3><p>{review.value.patients.length} pazienti · {review.value.diets.length} piani · {review.value.measurements.length} misurazioni · {review.value.appointments.length} appuntamenti.</p><label className="inline-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Confermo di sostituire tutto l’archivio locale con questo file.</label><p className="field-hint">I dati attuali verranno sostituiti in un’unica operazione. Esportali prima se vuoi conservarli.</p></> : <><h3>{review.value.name}</h3><p>Dieta condivisa · 7 giorni · importazione con nuovi identificatori, senza sovrascrivere i piani esistenti.</p><label>Destinazione<select value={targetPatient} onChange={e => setTargetPatient(e.target.value)}><option value="">Bozza del nutrizionista</option><option value="new">Il mio piano · nuovo profilo paziente</option>{patients.map(p => <option key={p.id} value={p.id}>Assegna a {p.name}</option>)}</select></label>{targetPatient === 'new' && <label>Nome del profilo<input value={selfName} maxLength={120} onChange={e => setSelfName(e.target.value)} /></label>}</>}
        <button className="button" disabled={busy || (review.type === 'backup' && !confirmed) || (targetPatient === 'new' && !selfName.trim())} onClick={apply}>{review.type === 'backup' ? 'Sostituisci archivio' : 'Importa dieta'}</button>
      </div>}
    </section></div></div>
  </>
}
