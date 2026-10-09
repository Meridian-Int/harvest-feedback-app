import type { HTMLAttributes, ReactNode } from 'react';

export function Panel({ heading, actions, children, className = '', ...props }: HTMLAttributes<HTMLElement> & { heading?: ReactNode; actions?: ReactNode }) {
  return <section className={`panel glass ${className}`} {...props}>
    {(heading || actions) && <div className="panel-head">{typeof heading === 'string' ? <h2>{heading}</h2> : heading}{actions}</div>}
    {children}
  </section>;
}
