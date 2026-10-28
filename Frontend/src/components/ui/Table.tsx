import type { TableHTMLAttributes } from 'react';
export default function Table({ caption, children, className = '', ...props }: TableHTMLAttributes<HTMLTableElement> & { caption: string }) {
  return <div className="ui-table-scroll" role="region" aria-label={caption} tabIndex={0}>
    <table {...props} className={`ui-table ${className}`}><caption className="visually-hidden">{caption}</caption>{children}</table>
  </div>;
}
