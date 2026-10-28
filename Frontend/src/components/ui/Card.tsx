import type { HTMLAttributes } from 'react';
export default function Card({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={`ui-card ${className}`} />;
}
