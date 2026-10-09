import { forwardRef, type ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'quiet';
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'default', className = '', type = 'button', ...props }, ref) {
  return <button ref={ref} type={type} className={`btn btn-${variant} ${className}`} {...props} />;
});
