import type { ButtonHTMLAttributes } from 'react';
import * as AlignButton from '../align/button';

export function TextButton({ className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <AlignButton.Root type={type} variant="neutral" mode="ghost" size="xxsmall" className={`text-btn ${className}`} {...props} />;
}
