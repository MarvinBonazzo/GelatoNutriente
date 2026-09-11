import { lazy, Suspense, useEffect, useState } from 'react'
import { BookOpen, CalendarDays, ChevronRight, ClipboardList, Download, ExternalLink, Leaf, Menu, ShieldCheck, ShoppingBasket, Settings2, TrendingUp, Users, X } from 'lucide-react'
import { HashRouter, Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAppStore } from '../store/app-store'
import { repositories } from '../repositories'
import { DietEditor } from '../pages/DietEditor'
import { Patients } from '../pages/Patients'
import { Foods } from '../pages/Foods'
import { PatientPlan } from '../pages/PatientPlan'
import { Shopping } from '../pages/Shopping'
import { Appointments } from '../pages/Appointments'
import { Settings } from '../pages/Settings'
import { ReminderBanner } from '../components/ReminderBanner'

const Measurements = lazy(() => import('../pages/Measurements').then(module => ({ default: module.Measurements })))

function Shell() {
  const { ready, error, initialize, dirty, notice, notify } = useAppStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const location = useLocation()
  const isPatient = location.pathname.startsWith('/paziente')
  useEffect(() => { void initialize() }, [initialize])
  useEffect(() => { setMenuOpen(false); window.scrollTo(0, 0) }, [location.pathname])
  useEffect(() => {
    if (!dirty) return
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => notify(undefined), 6500)
    return () => window.clearTimeout(timer)
  }, [notice, notify])
  async function exportData() {
    setExporting(true)
    try {
      const backup = await repositories.exportBackup()
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `GelatoNutriente-${new Date().toISOString().slice(0, 10)}.json`; anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      notify('Archivio esportato. Il file contiene i dati personali salvati: conservalo con cura.')
    } catch { notify('Esportazione non riuscita. Riprova senza chiudere la pagina.') }
    finally { setExporting(false) }
  }
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus() }}>Vai al contenuto</a>
    <header className="mobile-header"><Link className="brand" to="/piani"><span className="brand-symbol">g<span>•</span></span><span>Gelato<strong>Nutriente</strong></span></Link><button className="icon-button" aria-label={menuOpen ? 'Chiudi menu' : 'Apri menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></header>
    {menuOpen && <button className="nav-overlay" aria-label="Chiudi navigazione" onClick={() => setMenuOpen(false)} />}
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <Link className="brand" to="/piani"><span className="brand-symbol">g<span>•</span></span><span>Gelato<strong>Nutriente</strong></span></Link>
      <Link className="workspace-label" to="/impostazioni" aria-label="Apri spazio personale: studio e file"><span className="workspace-icon"><Leaf size={18} /></span><div>Il mio studio<small>Spazio personale</small></div><ChevronRight size={14} /></Link>
      <p className="nav-label">ORGANIZZA</p>
      <nav aria-label="Navigazione principale"><NavLink to="/piani"><ClipboardList size={19} />Piani alimentari</NavLink><NavLink to="/pazienti"><Users size={19} />Pazienti</NavLink><NavLink to="/alimenti"><BookOpen size={19} />Alimenti</NavLink><NavLink to="/spesa"><ShoppingBasket size={19} />Lista della spesa</NavLink><NavLink to="/misurazioni"><TrendingUp size={19} />Misurazioni</NavLink><NavLink to="/appuntamenti"><CalendarDays size={19} />Appuntamenti</NavLink><NavLink to="/impostazioni"><Settings2 size={19} />Studio e file</NavLink></nav>
      <div className="sidebar-bottom"><div className="local-info"><ShieldCheck size={20} /><strong>I dati restano qui</strong><p>Salvati in questo browser.<br />Nessun account, nessun server.</p><button onClick={exportData} disabled={exporting || !ready}><Download size={14} />{exporting ? 'Esportazione…' : 'Esporta JSON non cifrato'}</button></div><Link className="patient-mode" to={isPatient ? '/piani' : '/paziente'}><span className="avatar small">{isPatient ? 'N' : 'P'}</span><span>{isPatient ? 'Vista nutrizionista' : 'Vista paziente'}<small>{isPatient ? 'Torna al tuo studio' : 'Apri il piano assegnato'}</small></span><ExternalLink size={15} /></Link></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div><span className="breadcrumb">Il mio studio</span><ChevronRight size={14} /><strong>{location.pathname === '/impostazioni' ? 'Studio e file' : location.pathname.endsWith('/misurazioni') ? 'Misurazioni' : location.pathname.endsWith('/appuntamenti') ? 'Appuntamenti' : location.pathname === '/pazienti' ? 'Pazienti' : location.pathname === '/alimenti' ? 'Alimenti' : location.pathname === '/spesa' || location.pathname === '/paziente/spesa' ? 'Lista della spesa' : isPatient ? 'Vista paziente' : location.pathname === '/anteprima' ? 'Anteprima' : 'Piani alimentari'}</strong></div><span className="topbar-status"><i />Archivio locale</span></header>
      <main id="main-content" tabIndex={-1}><ReminderBanner patientView={isPatient} />{error && !ready ? <div className="large-empty panel"><h1>Archivio non disponibile</h1><p role="alert">{error}</p><button className="button" onClick={() => initialize()}>Riprova</button></div> : !ready ? <div className="loading-state" role="status">Apertura del tuo spazio…</div> : <Suspense fallback={<div className="loading-state" role="status">Caricamento…</div>}><Routes><Route path="/" element={<Navigate to="/piani" replace />} /><Route path="/piani" element={<DietEditor />} /><Route path="/pazienti" element={<Patients />} /><Route path="/alimenti" element={<Foods />} /><Route path="/spesa" element={<Shopping />} /><Route path="/misurazioni" element={<Measurements />} /><Route path="/paziente/misurazioni" element={<Measurements patientView />} /><Route path="/appuntamenti" element={<Appointments />} /><Route path="/paziente/appuntamenti" element={<Appointments patientView />} /><Route path="/impostazioni" element={<Settings />} /><Route path="/paziente/spesa" element={<Shopping patientView />} /><Route path="/anteprima" element={<PatientPlan key="preview" preview />} /><Route path="/paziente" element={<PatientPlan key="patient" />} /><Route path="*" element={<div className="large-empty panel"><h1>Pagina non trovata</h1><Link className="button" to="/piani">Torna ai piani</Link></div>} /></Routes></Suspense>}</main>
      <footer className="app-footer"><span>GelatoNutriente</span><span>v0.7 · Archivio locale</span></footer>
    </div>
    {notice && <div className="toast" role="status"><span>{notice}</span><button className="icon-button" onClick={() => notify(undefined)} aria-label="Chiudi messaggio"><X size={17} /></button></div>}
  </div>
}

export function App() { return <HashRouter><Shell /></HashRouter> }
