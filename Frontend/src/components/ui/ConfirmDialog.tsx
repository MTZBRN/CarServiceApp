import type { ReactNode } from 'react';
import Modal from './Modal';
import Button from './Button';
export default function ConfirmDialog({ title, children, confirmLabel = 'Megerősítés', onConfirm, onCancel }: { title: string; children: ReactNode; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  return <Modal title={title} onClose={onCancel} className="ui-confirm" footer={<><Button variant="secondary" data-autofocus onClick={onCancel}>Mégse</Button><Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button></>}><p className="ui-confirm-message">{children}</p></Modal>;
}
