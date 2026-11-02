import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { FormField, Input } from './Fields';
import './SearchableLookup.css';

interface LookupPage<T> {
  data: T[];
  search: string;
  q: string;
  setSearch: (value: string) => void;
  page: number;
  pageSize: number;
  totalCount: number;
  setPage: (page: number) => void;
  loading: boolean;
  loaded: boolean;
  error: unknown;
  refresh: () => Promise<void>;
}
interface Props<T> {
  label: string;
  lookup: LookupPage<T>;
  selectedItem?: T | null;
  onSelect: (item: T | null) => void;
  getKey: (item: T) => string | number;
  getLabel: (item: T) => string;
  placeholder: string;
  emptyLabel?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/** One server-paged combobox. Only an explicit action requests the next result page. */
export default function SearchableLookup<T>({ label, lookup, selectedItem, onSelect, getKey, getLabel, placeholder, emptyLabel, error, hint, disabled, autoFocus }: Props<T>) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [placement, setPlacement] = useState({ above: false, height: 320 });
  const pending = lookup.search !== lookup.q || lookup.loading || !lookup.loaded;
  const failed = lookup.error != null;
  const items = pending || failed ? [] : lookup.data;
  const options: (T | null)[] = emptyLabel ? [null, ...items] : items;
  const selectedLabel = selectedItem ? getLabel(selectedItem) : emptyLabel ?? '';
  const expanded = open && !disabled;
  const optionId = (index: number) => `${id}-option-${index}`;
  const choose = (item: T | null) => {
    onSelect(item);
    setOpen(false);
    setActive(-1);
    lookup.setSearch('');
    input.current?.focus();
  };
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  useEffect(() => { setActive(-1); }, [lookup.data, lookup.page, pending]);
  useLayoutEffect(() => {
    if (!expanded || !root.current) return;
    const container = root.current;
    const form = container.closest('form');
    const measure = () => {
      const anchor = container.getBoundingClientRect();
      const dialog = container.closest('.ui-modal');
      const dialogTop = dialog?.querySelector('.ui-modal-header')?.getBoundingClientRect().bottom ?? 12;
      const submitTop = form?.querySelector('button[type="submit"]')?.getBoundingClientRect().top;
      const bottom = Math.min(window.innerHeight - 12, dialog?.getBoundingClientRect().bottom ?? Infinity, submitTop && submitTop > anchor.bottom ? submitTop - 8 : Infinity);
      const below = bottom - anchor.bottom - 4;
      const above = anchor.top - Math.max(12, dialogTop) - 4;
      const placeAbove = below < 160 && above > below;
      const height = Math.max(80, Math.min(320, placeAbove ? above : below));
      setPlacement(previous => previous.above === placeAbove && previous.height === height ? previous : { above: placeAbove, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (form) observer.observe(form);
    window.addEventListener('resize', measure);
    document.addEventListener('scroll', measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      document.removeEventListener('scroll', measure, true);
    };
  }, [expanded]);
  useEffect(() => {
    if (expanded && active >= 0) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' });
  }, [active, expanded, id]);

  return <div ref={root} className="searchable-lookup" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <FormField label={label} error={error} hint={hint}>
      <Input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-haspopup="listbox"
        aria-expanded={expanded} aria-controls={id + '-results'} aria-activedescendant={expanded && active >= 0 && active < options.length ? optionId(active) : undefined}
        autoComplete="off" disabled={disabled} data-autofocus={autoFocus || undefined}
        placeholder={placeholder} value={expanded ? lookup.search : selectedLabel}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
        onChange={event => { lookup.setSearch(event.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            setActive(previous => options.length ? event.key === 'ArrowDown' ? Math.min(previous + 1, options.length - 1) : previous <= 0 ? options.length - 1 : previous - 1 : -1);
          } else if (event.key === 'Enter' && expanded) {
            event.preventDefault();
            if (active >= 0 && active < options.length) choose(options[active]);
          } else if (event.key === 'Escape' && expanded) {
            event.preventDefault(); event.stopPropagation(); setOpen(false); setActive(-1);
          }
        }} />
    </FormField>
    <span className="visually-hidden" aria-live="polite">{selectedLabel ? `Kiválasztva: ${selectedLabel}` : ''}</span>
    <ChevronDown className="searchable-lookup-chevron" size={16} aria-hidden="true" />
    {expanded && <div className="searchable-lookup-menu" data-placement={placement.above ? 'above' : 'below'} style={{ maxHeight: placement.height }}>
      <ul id={id + '-results'} role="listbox" aria-label={label} aria-busy={pending}>
        {options.map((item, index) => {
          const selected = item === null ? !selectedItem : !!selectedItem && getKey(item) === getKey(selectedItem);
          return <li key={item === null ? 'empty' : getKey(item)} id={optionId(index)} role="option" aria-selected={selected}
            data-active={active === index} onMouseDown={event => event.preventDefault()}
            onMouseMove={() => setActive(index)} onClick={() => choose(item)}>
            <span>{item === null ? emptyLabel : getLabel(item)}</span>{selected && <Check size={16} aria-hidden="true" />}
          </li>;
        })}
      </ul>
      <p className="searchable-lookup-status" role="status">{pending ? 'Találatok betöltése…' : failed ? 'A találatok betöltése nem sikerült.' : !items.length ? 'Nincs találat.' : `${lookup.totalCount} találat`}</p>
      {!pending && failed && <button type="button" className="searchable-lookup-more" onClick={() => { void lookup.refresh(); input.current?.focus(); }}>Találatok újratöltése</button>}
      {!pending && !failed && lookup.page * lookup.pageSize < lookup.totalCount && <button type="button" className="searchable-lookup-more" onClick={() => {
        lookup.setPage(lookup.page + 1); setActive(-1); input.current?.focus();
      }}>További találatok</button>}
    </div>}
  </div>;
}
