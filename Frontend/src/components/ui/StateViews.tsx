import type { ReactNode } from 'react';
import { CircleAlert, Inbox, LoaderCircle } from 'lucide-react';
import Button from './Button';
import Card from './Card';
export function LoadingState({ message = 'Betöltés...' }: { message?: string }) {
  return <div className="ui-state" role="status"><LoaderCircle size={20} aria-hidden="true" /><span>{message}</span></div>;
}
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <Card className="ui-state"><Inbox size={24} aria-hidden="true" /><h2>{title}</h2>{children && <p>{children}</p>}{action}</Card>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="ui-state" role="alert"><CircleAlert size={22} aria-hidden="true" /><span>{message}</span>{onRetry && <Button variant="secondary" onClick={onRetry}>Újrapróbálás</Button>}</div>;
}
