import { useSearchParams } from 'react-router-dom';
import { EmptyState, Panel, SegmentedControl } from '../../components/ui';

/** Phase 0 route target; integrations belong to Phase 2. */
export function InsightsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'traffic' ? 'traffic' : 'errors';
  return <section id="view-admin-insights"><div className="pagehead"><div><h1>Product insights</h1></div><SegmentedControl label="Insight view" value={tab} options={[{ value: 'errors', label: 'Errors' }, { value: 'traffic', label: 'Traffic' }]} onChange={value => setParams(previous => { previous.set('tab', value); return previous; })} /></div><Panel heading={tab === 'errors' ? 'Errors' : 'Traffic'}><EmptyState>Product insights will be added in the admin phase.</EmptyState></Panel></section>;
}
