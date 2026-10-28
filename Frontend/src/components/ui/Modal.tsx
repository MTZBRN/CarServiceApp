import { useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import DialogSurface from './DialogSurface';
import IconButton from './IconButton';
interface ModalProps { title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; className?: string; }
export default function Modal({ title, subtitle, onClose, children, footer, className = '' }: ModalProps) {
  const descriptionId = useId();
  return <DialogSurface title={title} onClose={onClose} aria-describedby={subtitle ? descriptionId : undefined}>
    <div className={`modal-content ui-modal ${className}`}>
      <header className="ui-modal-header"><div><h2>{title}</h2>{subtitle && <p id={descriptionId}>{subtitle}</p>}</div><IconButton label="Bezárás" onClick={onClose}><X size={18} aria-hidden="true" /></IconButton></header>
      <div className="ui-modal-body">{children}</div>
      {footer && <footer className="ui-modal-footer">{footer}</footer>}
    </div>
  </DialogSurface>;
}
