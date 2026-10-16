import { forwardRef, type InputHTMLAttributes } from 'react';
import * as AlignInput from '../align/input';

/** Align UI Input (xsmall, 32px). className styles the field's outer box. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = '', size: _size, ...props }, ref) {
  const invalid = props['aria-invalid'] === true || props['aria-invalid'] === 'true';
  return <AlignInput.Root size="xsmall" hasError={invalid} className={className}>
    <AlignInput.Wrapper><AlignInput.Input ref={ref} {...props} /></AlignInput.Wrapper>
  </AlignInput.Root>;
});
