import { PRIORITY_LABELS, SEVERITY_LABELS } from '../../lib/options';
import type { Priority, Severity } from '../../lib/types';

export function Pill({ value }: { value: Priority | Severity }) {
  const label = Object.hasOwn(PRIORITY_LABELS, value) ? PRIORITY_LABELS[value as Priority] : SEVERITY_LABELS[value as Severity];
  return <span className="pill" data-value={value}><span className="dot" aria-hidden="true" />{label}</span>;
}
