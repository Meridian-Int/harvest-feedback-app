import { EmptyState, Panel } from '../../components/ui';

/** Phase 0 placeholder. Manasa owns the form implementation in this folder. */
export function NewFeedbackPage() {
  return <section className="form-container" id="view-client"><div className="pagehead"><div><div className="eyebrow">Client workspace</div><h1>Share your feedback</h1><p>Report an issue or suggest an improvement to Harvest.</p></div></div><Panel heading="New feedback"><EmptyState>The feedback form will be added in the client phase.</EmptyState></Panel></section>;
}
