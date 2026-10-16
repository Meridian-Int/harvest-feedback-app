import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cnExt } from '../align/cn';

/** Native select styled as Align UI's Select trigger (xsmall). It stays native so keyboard, screen readers and phones keep their own pickers. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className = '', ...props }, ref) {
  const invalid = props['aria-invalid'] === true || props['aria-invalid'] === 'true';
  return <select ref={ref} className={cnExt(
    'align-select h-8 min-w-0 cursor-pointer appearance-none rounded-lg border-0 bg-bg-white-0 bg-[length:16px] bg-[position:right_8px_center] bg-no-repeat pl-2.5 pr-8 text-paragraph-sm text-text-strong-950 shadow-regular-xs',
    'ring-1 ring-inset ring-stroke-soft-200 outline-none transition duration-200 ease-out',
    'hover:bg-bg-weak-50 hover:ring-transparent focus-visible:shadow-button-important-focus focus-visible:ring-stroke-strong-950',
    'disabled:cursor-not-allowed disabled:bg-bg-weak-50 disabled:text-text-disabled-300 disabled:shadow-none disabled:ring-transparent',
    invalid && 'ring-error-base focus-visible:shadow-button-error-focus focus-visible:ring-error-base',
    className,
  )} {...props} />;
});
