import type { HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { useDialog } from './useDialog';
interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick' | 'title'> {
  title: string; onClose: () => void; initialFocus?: 'container' | 'first'; dismissOnBackdrop?: boolean;
}
export default function DialogSurface({ title, onClose, initialFocus = 'first', dismissOnBackdrop = false, className = 'modal-overlay', children, ...props }: Props) {
  const ref = useDialog(onClose, initialFocus);
  return createPortal(<div {...props} ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={className} onClick={event => { if (dismissOnBackdrop && event.target === event.currentTarget) onClose(); }}>{children}</div>, document.body);
}
