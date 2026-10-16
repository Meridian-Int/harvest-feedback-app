import { forwardRef, type ButtonHTMLAttributes } from 'react';
import * as AlignButton from '../align/button';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'quiet';
}
/** Align UI Button. HARVEST's primary is monochrome, so primary is Align's neutral filled button. */
const MODES = { default: 'stroke', primary: 'filled', quiet: 'ghost' } as const;
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'default', className = '', type = 'button', ...props }, ref) {
  return <AlignButton.Root ref={ref} type={type} variant="neutral" mode={MODES[variant]} size="xsmall" className={`btn-${variant} ${className}`} {...props} />;
});
