import type { ReactNode } from 'react';

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty text-muted">{children}</div>;
}
