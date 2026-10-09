import type { ReactNode } from 'react';

export interface SegmentOption<T extends string> { value: T; label: ReactNode }
export function SegmentedControl<T extends string>({ label, options, value, onChange, compact = false }: {
  label: string; options: readonly SegmentOption<T>[]; value: T; onChange: (value: T) => void; compact?: boolean;
}) {
  return <div className={`seg ${compact ? 'seg-compact' : ''}`} role="group" aria-label={label}>
    {options.map(option => <button type="button" key={option.value} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </div>;
}
