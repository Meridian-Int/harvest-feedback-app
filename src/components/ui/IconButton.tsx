import type { ButtonHTMLAttributes } from 'react';

export function IconButton({ label, className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type={type} className={`icon-btn ${className}`} aria-label={label} title={label} {...props} />;
}
