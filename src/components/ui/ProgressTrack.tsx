import { Icon, type IconName } from '../icons';
import * as AlignStepper from '../align/horizontal-stepper';
import * as AlignDots from '../align/dot-stepper';
import * as AlignStatus from '../align/status-badge';
import { STATUS_LABELS, STATUS_ORDER } from '../../lib/options';
import { statusStep } from '../../lib/status';
import type { Status } from '../../lib/types';

export type ProgressVariant = 'full' | 'compact' | 'dots';

/** Report status as HARVEST's stepper: labelled steps with chevrons (full/compact) or HARVEST's dot stepper for cards. */
export function ProgressTrack({ status, compact = false, variant }: { status: Status; compact?: boolean; variant?: ProgressVariant }) {
  const kind: ProgressVariant = variant ?? (compact ? 'compact' : 'full');
  const current = statusStep(status);
  const steps = STATUS_ORDER.map((step, index) => ({ step, index, done: index < current || status === 'CLOSED', current: index === current }));
  if (kind === 'dots') {
    /* Align UI DotStepper: finished steps green, the current one in the primary colour. */
    return <div className="progress-dots flex items-center gap-2" data-status={status}>
      <AlignDots.Root asChild size="small"><ol aria-label="Report progress">
        {steps.map(({ step, done, current: isCurrent }) => <AlignDots.Item asChild key={step}><li className={`${done ? 'completed !bg-success-base' : isCurrent ? 'current !bg-bg-strong-950' : 'future'}`} aria-current={isCurrent ? 'step' : undefined}><span className="sr-only">{STATUS_LABELS[step]}</span></li></AlignDots.Item>)}
      </ol></AlignDots.Root>
      <span className="progress-dots-label text-paragraph-xs text-text-sub-600">Step {current + 1} of {STATUS_ORDER.length}</span>
    </div>;
  }
  /* Align UI HorizontalStepper: green tick when done, filled number for the current step, chevrons between. */
  return <AlignStepper.Root asChild><ol className={`progress-track ${kind === 'compact' ? 'compact-progress' : ''} !justify-start`} aria-label="Report progress">
    {steps.map(({ step, index, done, current: isCurrent }) => {
      const state = done ? 'completed' : isCurrent ? 'active' : 'default';
      return <AlignStepper.Item asChild key={step} state={state}><li className={`${done ? 'completed' : isCurrent ? 'current' : 'future'} ${kind === 'compact' ? 'text-paragraph-xs' : ''}`} aria-current={isCurrent ? 'step' : undefined}>
        <AlignStepper.ItemIndicator state={state} className={`${state === 'active' ? '!bg-bg-strong-950 !text-text-white-0' : ''} ${kind === 'compact' ? 'size-4 text-[11px]' : ''}`} aria-hidden="true">{index + 1}</AlignStepper.ItemIndicator>
        <span className="progress-label">{STATUS_LABELS[step]}</span>
        {index < steps.length - 1 && <Icon name="chevron-right" className={`${kind === 'compact' ? 'size-4' : 'size-5'} -mx-1 text-text-soft-400`} />}
      </li></AlignStepper.Item>;
    })}
  </ol></AlignStepper.Root>;
}

/** HARVEST status badge (stroke variant): the report's current stage with a coloured dot. */
const STATUS_MARK: Record<Status, IconName> = { NEW: 'circle', ASSIGNED: 'timer', IN_PROGRESS: 'clock', CLOSED: 'check-circle' };
export function StatusBadge({ status }: { status: Status }) {
  return <AlignStatus.Root asChild variant="stroke" status={status === 'CLOSED' ? 'completed' : 'disabled'}><span className="status-badge" data-status={status}><Icon name={STATUS_MARK[status]} className={`-mx-1 size-4 ${status === 'CLOSED' ? 'text-success-base' : 'text-text-soft-400'}`} />{STATUS_LABELS[status]}</span></AlignStatus.Root>;
}
