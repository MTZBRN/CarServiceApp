import type { ButtonHTMLAttributes } from 'react';
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { label: string; }
export default function IconButton({ label, className = '', type = 'button', ...props }: IconButtonProps) {
  return <button {...props} type={type} aria-label={label} title={label} className={`ui-icon-button ${className}`} />;
}
