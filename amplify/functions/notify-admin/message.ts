export interface ReportNotice { id: string; title: string; company: string; persona: string; sentryIssueId?: string | null }

export function reportNotice(report: ReportNotice, appBaseUrl: string) {
  const displayId = `FB-${report.id.slice(-4).toUpperCase()}`;
  const link = appBaseUrl.trim() ? `${appBaseUrl.replace(/\/$/, '')}/admin/reviews?report=${encodeURIComponent(report.id)}` : '';
  return {
    subject: `HARVEST feedback: ${displayId} from ${report.company}`,
    body: `A ${report.persona.toLowerCase()} submitted a new report.\n\n${displayId}: ${report.title}\nCompany: ${report.company}\n${link ? `\nOpen report: ${link}\n` : '\nOpen Review queue in HARVEST to see it.\n'}`,
  };
}

export function adminEmails(users: { Enabled?: boolean; Attributes?: { Name?: string; Value?: string }[] }[]): string[] {
  const emails = users.filter(user => user.Enabled !== false).map(user => user.Attributes?.find(attribute => attribute.Name === 'email')?.Value?.trim().toLowerCase())
    .filter((email): email is string => !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  return [...new Set(emails)];
}
