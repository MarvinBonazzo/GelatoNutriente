import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './app/styles.css'

// The home entry always opens plans; explicit links to other sections stay usable.
if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/piani`)
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
