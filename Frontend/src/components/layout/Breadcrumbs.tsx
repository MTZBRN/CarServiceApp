import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
export interface Breadcrumb { label: string; to?: string; }
export default function Breadcrumbs({ items }: { items: Breadcrumb[] }) {
  return <nav aria-label="Morzsamenü" className="shell-breadcrumbs"><ol>{items.map((item, i) => <li key={i}>{i > 0 && <ChevronRight size={12} aria-hidden="true" />}{item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</li>)}</ol></nav>;
}
