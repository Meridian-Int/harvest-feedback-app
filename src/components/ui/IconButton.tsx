import type { ButtonHTMLAttributes } from 'react';
import * as AlignButton from '../align/button';

/** Align UI neutral stroke Button, square; children are an icon and optional text. */
export function IconButton({ label, className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <AlignButton.Root type={type} variant="neutral" mode="stroke" size="xsmall" className={`icon-btn min-w-8 px-2 ${className}`} aria-label={label} title={label} {...props} />;
}
