import { EmptyState, Panel, Tag } from '../../components/ui';

/** Phase 0 route target; queue and editing controls belong to Phase 1. */
export function ReviewPage() {
  return <section className="report-page" id="view-admin"><div className="pagehead"><div><h1>Feedback review</h1><p>Review, assign and respond to client reports.</p></div><Tag>Admin</Tag></div><Panel heading="Feedback review"><EmptyState>The review queue will be added in the admin phase.</EmptyState></Panel></section>;
}
