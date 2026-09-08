import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return <dialog ref={ref} className="modal" onCancel={onClose} aria-labelledby="modal-title" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="modal-inner"><header><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Chiudi"><X size={20} /></button></header>{children}</div>
  </dialog>
}
