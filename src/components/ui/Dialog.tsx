import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from '../icons';
import { Button } from './Button';
import { IconButton } from './IconButton';

export function Dialog({ open, onClose, title, children, footer, closeLabel = 'Close report' }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} className="dialog glass" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClose={() => { if (open) onClose(); }}>
    <div className="dialog-head"><div id={titleId}>{title}</div><IconButton label={closeLabel} onClick={onClose}><Icon name="close" /></IconButton></div>
    <div className="dialog-body">{children}</div>
    <div className="dialog-footer">{footer ?? <Button onClick={onClose}>Done</Button>}</div>
  </dialog>;
}
