import { Link } from 'react-router-dom';
import { EmptyState, Panel } from '../../components/ui';

/** Phase 0 placeholder. No report-list implementation yet. */
export function MyReportsPage() {
  return <section className="report-page" id="view-mine"><div className="pagehead"><div><h1>My reports</h1><p>Follow your feedback from the first report to the fix.</p></div><Link to="/feedback/new" className="btn btn-primary">New feedback</Link></div><Panel heading="Your reports"><EmptyState>My reports will be added in the client phase.</EmptyState></Panel></section>;
}
