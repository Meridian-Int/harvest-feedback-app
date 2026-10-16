import { PRIORITY_LABELS, SEVERITY_LABELS } from '../../lib/options';
import type { Priority, Severity } from '../../lib/types';
import { Icon } from '../icons';
import * as AlignTag from '../align/tag';

/** Align UI Tag (stroke). Neutral text; only Critical carries colour, as a red alert mark. */
export function Pill({ value }: { value: Priority | Severity }) {
  const label = Object.hasOwn(PRIORITY_LABELS, value) ? PRIORITY_LABELS[value as Priority] : SEVERITY_LABELS[value as Severity];
  const critical = value === 'CRITICAL';
  return <AlignTag.Root asChild variant="stroke" className={`pill ${critical ? 'text-error-base' : ''}`}>
    <span data-value={value}>{critical && <Icon name="alert" className="-mx-0.5 size-4" />}{label}</span>
  </AlignTag.Root>;
}
