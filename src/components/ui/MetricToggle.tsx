export function MetricToggle({ label, count, helper, selected, onClick }: {
  label: string; count: number; helper: string; selected: boolean; onClick: () => void;
}) {
  return <button type="button" className="metric-toggle" aria-pressed={selected} onClick={onClick}>
    <span>{label}</span><strong>{count}</strong><small>{helper}</small>
  </button>;
}
