import type { ButtonHTMLAttributes } from 'react';

export function TextButton({ className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={`text-btn ${className}`} {...props} />;
}
