import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { isHarvestSharedSessionMode, isLocalFeedbackPreview, requireAmplify } from './amplify';
import { requireUser } from './auth';
import { sharedRequest } from './shared-feedback-api';

const client = generateClient<Schema>();

/** Read receipts are owner-authorized and stream to every session of that user. */
export function subscribeNotificationReads(next: (eventIds: Set<string>) => void, error: (cause: Error) => void): () => void {
  if (isLocalFeedbackPreview()) {
    let active = true;
    queueMicrotask(() => { if (active) next(new Set()); });
    return () => { active = false; };
  }
  requireAmplify();
  requireUser();
  if (isHarvestSharedSessionMode()) {
    let active = true;
    const refresh = () => {
      void (async () => {
        const ids = new Set<string>();
        let nextToken: string | null = null;
        do {
          const data: { listNotificationReads?: { items?: { eventId: string }[]; nextToken?: string | null } } =
            await sharedRequest(`query ListNotificationReads($nextToken: String) {
              listNotificationReads(nextToken: $nextToken) { items { eventId } nextToken }
            }`, { nextToken });
          if (!data.listNotificationReads?.items) throw new Error('Could not load notifications.');
          data.listNotificationReads.items.forEach(item => ids.add(item.eventId));
          nextToken = data.listNotificationReads.nextToken ?? null;
        } while (nextToken);
        if (active) next(ids);
      })().catch(cause => { if (active) error(cause instanceof Error ? cause : new Error('Could not load notifications.')); });
    };
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }
  const subscription = client.models.NotificationRead.observeQuery().subscribe({
    next: ({ items, isSynced }) => { if (isSynced) next(new Set(items.map(item => item.eventId))); },
    error: (cause: unknown) => error(cause instanceof Error ? cause : new Error('Could not load notifications.')),
  });
  return () => subscription.unsubscribe();
}

export async function markNotificationsRead(eventIds: string[]): Promise<void> {
  if (isLocalFeedbackPreview()) return;
  requireAmplify();
  const user = requireUser();
  await Promise.all(eventIds.map(async eventId => {
    const id = `${user.id}::${eventId}`;
    if (isHarvestSharedSessionMode()) {
      try {
        await sharedRequest(`mutation CreateNotificationRead($input: CreateNotificationReadInput!) {
          createNotificationRead(input: $input) { id eventId }
        }`, { input: { id, eventId } });
      } catch (cause) {
        const existing = await sharedRequest<{ getNotificationRead?: { eventId: string } | null }>(
          `query GetNotificationRead($id: ID!) { getNotificationRead(id: $id) { eventId } }`, { id },
        );
        if (existing.getNotificationRead?.eventId !== eventId) throw cause;
      }
      return;
    }
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
