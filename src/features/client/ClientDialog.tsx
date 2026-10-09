import { useEffect, type ReactNode } from 'react';
import { Dialog } from '../../components/ui';

export function ClientDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <Dialog open title={<h2>{title}</h2>} onClose={onClose} closeLabel={`Close ${title}`} footer={<></>}>
    <div className="harvest-client">{children}</div>
  </Dialog>;
}
