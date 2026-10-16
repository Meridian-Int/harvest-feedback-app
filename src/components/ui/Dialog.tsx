import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from '../icons';
import { Button } from './Button';
import { IconButton } from './IconButton';

/** Native modal dialog (keeps the browser's focus and Escape handling) with Align UI Modal styling. */
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
  return <dialog ref={ref} className="dialog rounded-20 bg-bg-white-0 p-0 shadow-regular-md ring-1 ring-inset ring-stroke-soft-200" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClose={() => { if (open) onClose(); }}>
    <div className="dialog-head flex items-center justify-between gap-3 border-b border-stroke-soft-200 px-5 py-3 text-label-sm text-text-strong-950"><div id={titleId}>{title}</div><IconButton label={closeLabel} onClick={onClose}><Icon name="close" /></IconButton></div>
    <div className="dialog-body">{children}</div>
    <div className="dialog-footer flex items-center justify-end gap-3 border-t border-stroke-soft-200 px-5 py-3">{footer ?? <Button onClick={onClose}>Done</Button>}</div>
  </dialog>;
}
