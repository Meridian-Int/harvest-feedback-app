import { useEffect, useRef } from 'react';

export function Toast({ message, onDismiss }: { message: string | null; onDismiss: () => void }) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => dismiss.current(), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);
  return message ? <div className="toast" role="status">{message}</div> : null;
}
