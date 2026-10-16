import type { SVGProps } from 'react';
import type { IconName } from './symbols';

export function Icon({ name, className = '', ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg className={`icon ${className}`} fill="currentColor" aria-hidden="true" {...props}>
    <use href={`#i-${name}`} />
  </svg>;
}
