import type { Choices, Draft } from '../contract';
import { emptyDraft } from './form';

type DraftStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export const draftKey = (scope: string) => `harvest-client-draft:v1:${scope}`;
export function readDraft(store: DraftStore, scope: string, choices: Choices): Draft {
  try {
    const data: unknown = JSON.parse(store.getItem(draftKey(scope)) || 'null');
    if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('fields' in data) || !data.fields || typeof data.fields !== 'object') return emptyDraft();
    const fields = data.fields as Record<string, unknown>;
    const text = (key: keyof Draft, limit: number) => typeof fields[key] === 'string' ? (fields[key] as string).slice(0, limit) : '';
    const option = (key: keyof Draft, options: Choices['productAreas']) => options.some(o => o.value === fields[key]) ? String(fields[key]) : '';
    return { productArea: option('productArea', choices.productAreas), customArea: text('customArea', 80), priority: option('priority', choices.priorities), severity: option('severity', choices.severities), description: text('description', 3000) };
  } catch { return emptyDraft(); }
}
export function saveDraft(store: DraftStore, scope: string, draft: Draft): boolean {
  try {
    // Explicit allowlist: never serialize attachment bytes or account attributes.
    const { productArea, customArea, priority, severity, description } = draft;
    store.setItem(draftKey(scope), JSON.stringify({ version: 1, fields: { productArea, customArea, priority, severity, description } }));
    return true;
  } catch { return false; }
}
export function clearDraft(store: DraftStore, scope: string): boolean {
  try { store.removeItem(draftKey(scope)); return true; } catch { return false; }
}
