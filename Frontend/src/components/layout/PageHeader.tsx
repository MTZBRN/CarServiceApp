import type { ReactNode } from 'react';
import Breadcrumbs, { type Breadcrumb } from './Breadcrumbs';
export default function PageHeader({ title, breadcrumbs, actions }: { title: string; breadcrumbs?: Breadcrumb[]; actions?: ReactNode }) {
  return <div className="shell-page-header"><div>{breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} /> : <span className="shell-eyebrow">Műhelykezelő</span>}<h1>{title}</h1></div>{actions && <div className="shell-header-actions">{actions}</div>}</div>;
}
