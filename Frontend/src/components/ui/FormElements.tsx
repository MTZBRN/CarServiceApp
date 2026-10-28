import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from 'react';
import { Check, ChevronDown, type LucideIcon } from 'lucide-react';
import { Input } from './Fields';
interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> { label?: string; icon?: LucideIcon; }
export function InputField({ label, icon: Icon, id: suppliedId, ...props }: InputFieldProps) {
  const generated = useId(); const id = suppliedId || generated;
  return <div className="ui-legacy-field">{label && <label htmlFor={id}>{label}</label>}<div className={'ui-input-wrap' + (Icon ? ' has-icon' : '')}>{Icon && <Icon size={16} aria-hidden="true" className="ui-input-icon" />}<Input {...props} id={id} /></div></div>;
}
interface SelectFieldProps { label?: string; icon?: LucideIcon; value: string | number; onChange: (e: { target: { value: string } }) => void; options: { value: string | number; label: string }[]; placeholder?: string; required?: boolean; }
export function SelectField({ label, icon: Icon, value, onChange, options, placeholder = '-- Válassz --', required }: SelectFieldProps) {
  const id = useId(); const container = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false); const [active, setActive] = useState(0);
  const selected = options.findIndex(option => String(option.value) === String(value));
  useEffect(() => {
    const outside = (event: MouseEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', outside); return () => document.removeEventListener('mousedown', outside);
  }, []);
  useEffect(() => { if (open) document.getElementById(id + '-option-' + active)?.scrollIntoView({ block: 'nearest' }); }, [open, active, id]);
  const choose = (index: number) => { const option = options[index]; if (option) onChange({ target: { value: String(option.value) } }); setOpen(false); trigger.current?.focus(); };
  return <div className="ui-legacy-field" ref={container}>{label && <label id={id + '-label'} htmlFor={id}>{label}</label>}
    <div className={'ui-input-wrap' + (Icon ? ' has-icon' : '')}>{Icon && <Icon size={16} aria-hidden="true" className="ui-input-icon" />}
      <button ref={trigger} id={id} type="button" role="combobox" className="ui-field ui-select-trigger" aria-labelledby={label ? id + '-label' : undefined} aria-label={label ? undefined : placeholder} aria-expanded={open} aria-controls={open ? id + '-list' : undefined} aria-haspopup="listbox" aria-required={required} aria-activedescendant={open && options.length ? id + '-option-' + active : undefined}
        onClick={() => { setOpen(!open); setActive(selected < 0 ? 0 : selected); }}
        onKeyDown={event => {
          if (event.key === 'Escape' && open) { event.stopPropagation(); event.preventDefault(); setOpen(false); }
          else if (event.key === 'Tab') setOpen(false);
          else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault(); setOpen(true);
            setActive(previous => event.key === 'Home' ? 0 : event.key === 'End' ? Math.max(0, options.length - 1) : !open ? Math.max(0, selected) : Math.max(0, Math.min(options.length - 1, previous + (event.key === 'ArrowDown' ? 1 : -1))));
          } else if (open && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); choose(active); }
          else if (event.key.length === 1 && event.key !== ' ') { const match = options.findIndex(o => o.label.toLocaleLowerCase('hu').startsWith(event.key.toLocaleLowerCase('hu'))); if (match >= 0) { event.preventDefault(); setOpen(true); setActive(match); } }
        }}><span className={selected < 0 ? 'ui-select-placeholder' : undefined}>{selected < 0 ? placeholder : options[selected].label}</span><ChevronDown size={16} aria-hidden="true" /></button>
    </div>
    {open && <div id={id + '-list'} role="listbox" aria-labelledby={label ? id + '-label' : undefined} aria-label={label ? undefined : placeholder} className="ui-select-list">{options.length ? options.map((option, index) => <div key={option.value} id={id + '-option-' + index} role="option" aria-selected={index === selected} className={'ui-select-option' + (index === active ? ' is-focused' : '')} onMouseDown={event => event.preventDefault()} onMouseMove={() => setActive(index)} onClick={() => choose(index)}><span>{option.label}</span>{index === selected && <Check size={14} aria-hidden="true" />}</div>) : <div className="ui-select-empty">Nincs adat</div>}</div>}
  </div>;
}
