import { forwardRef, type TextareaHTMLAttributes } from 'react';
import * as AlignTextarea from '../align/textarea';

/** Align UI Textarea, simple variant. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className = '', children: _children, ...props }, ref) {
  const invalid = props['aria-invalid'] === true || props['aria-invalid'] === 'true';
  return <AlignTextarea.Root ref={ref} simple hasError={invalid} className={`min-h-20 rounded-lg px-2.5 py-2 ${className}`} {...props} />;
});
