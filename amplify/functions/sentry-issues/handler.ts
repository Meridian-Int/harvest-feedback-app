type SentryRow = {
  id?: string;
  title?: string;
  culprit?: string;
  project?: { slug?: string };
  level?: string;
  count?: string | number;
  userCount?: number;
  lastSeen?: string;
  permalink?: string;
  stats?: { '24h'?: [number, number][] };
};

const DEFAULT_PROJECTS = ['harvest-ui', 'harvest-api', 'feedback-app'];

function projectsFromEnvironment(value: string | undefined): string[] {
  const configured = value?.split(',').map(project => project.trim()).filter(Boolean);
  return configured?.length ? [...new Set(configured)] : DEFAULT_PROJECTS;
}

function toIssue(row: SentryRow, project: string) {
  return {
    id: String(row.id ?? ''),
    title: row.title ?? '',
    culprit: row.culprit ?? '',
    project: row.project?.slug ?? project,
    level: row.level ?? 'error',
    count: Number(row.count ?? 0),
    userCount: Number(row.userCount ?? 0),
    lastSeen: row.lastSeen ?? '',
    permalink: row.permalink ?? '',
    trend: (row.stats?.['24h'] ?? []).map((point) => Number(point[1] ?? 0)),
  };
}

export async function handler() {
  const token = process.env.SENTRY_AUTH_TOKEN?.trim();
  const org = process.env.SENTRY_ORG?.trim();
  if (!token || !org) return { configured: false, issues: [] };

  const projects = projectsFromEnvironment(process.env.SENTRY_PROJECTS);
  const issueLists = await Promise.all(projects.map(async project => {
    const url = new URL(`https://sentry.io/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/`);
    url.searchParams.set('query', 'is:unresolved');
    url.searchParams.set('statsPeriod', '24h');
    url.searchParams.set('limit', '100');
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Sentry issues request failed (${response.status})`);
    const rows = await response.json() as SentryRow[];
    if (!Array.isArray(rows)) throw new Error('Sentry issues response was invalid');
    return rows.map(row => toIssue(row, project));
  }));

  return { configured: true, issues: issueLists.flat().sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)) };
}
