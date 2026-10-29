import { useId, type Ref, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactElement, type ReactNode, cloneElement } from 'react';
interface ControlProps { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; }
export function FormField({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactElement<ControlProps> }) {
  const generated = useId();
  const id = children.props.id || generated;
  const details = [children.props['aria-describedby'], hint ? id + '-hint' : '', error ? id + '-error' : ''].filter(Boolean).join(' ') || undefined;
  return <div className="ui-form-field">
    <label htmlFor={id}>{label}</label>
    {cloneElement(children, { id, 'aria-describedby': details, 'aria-invalid': !!error || children.props['aria-invalid'] })}
    {hint && <span id={id + '-hint'} className="ui-field-hint">{hint}</span>}
    {error && <span id={id + '-error'} className="ui-field-error">{error}</span>}
  </div>;
}
export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) { return <input {...props} className={`ui-field ${className}`} />; }
export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) { return <select {...props} className={`ui-field ${className}`}>{children}</select>; }
export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className={`ui-field ui-textarea ${className}`} />; }
