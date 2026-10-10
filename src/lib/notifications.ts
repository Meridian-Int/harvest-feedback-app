import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { requireAmplify } from './amplify';
import { requireUser } from './auth';

const client = generateClient<Schema>();

/** Read receipts are owner-authorized and stream to every session of that user. */
export function subscribeNotificationReads(next: (eventIds: Set<string>) => void, error: (cause: Error) => void): () => void {
  requireAmplify();
  requireUser();
  const subscription = client.models.NotificationRead.observeQuery().subscribe({
    next: ({ items, isSynced }) => { if (isSynced) next(new Set(items.map(item => item.eventId))); },
    error: (cause: unknown) => error(cause instanceof Error ? cause : new Error('Could not load notifications.')),
  });
  return () => subscription.unsubscribe();
}

export async function markNotificationsRead(eventIds: string[]): Promise<void> {
  requireAmplify();
  const user = requireUser();
  await Promise.all(eventIds.map(async eventId => {
    const id = `${user.id}::${eventId}`;
    const result = await client.models.NotificationRead.create({
      id,
      eventId,
    });
    if (result.errors?.length) {
      // Two tabs can try to mark the same event at once. An existing receipt is success.
      const existing = await client.models.NotificationRead.get({ id });
      if (existing.data?.eventId !== eventId) throw new Error(result.errors[0].message);
    }
  }));
}
