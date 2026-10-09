import { Icon } from '../icons';
import { STATUS_LABELS, STATUS_ORDER } from '../../lib/options';
import { statusStep } from '../../lib/status';
import type { Status } from '../../lib/types';

export function ProgressTrack({ status, compact = false }: { status: Status; compact?: boolean }) {
  const current = statusStep(status);
  return <ol className={`progress-track ${compact ? 'compact-progress' : ''}`} aria-label="Report progress">
    {STATUS_ORDER.map((step, index) => {
      const done = index < current || status === 'CLOSED';
      return <li key={step} className={done ? 'completed' : index === current ? 'current' : 'future'} aria-current={index === current ? 'step' : undefined}>
        <span className="progress-dot" aria-hidden="true">{done ? <Icon name="check" /> : index + 1}</span>
        <span>{STATUS_LABELS[step]}</span>
      </li>;
    })}
  </ol>;
}
