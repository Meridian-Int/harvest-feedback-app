export function displayId(id: string): string {
  return `FB-${id.slice(-4).toUpperCase()}`;
}

export function titleFromDescription(description: string): string {
  return description.trim().split(/\r?\n/, 1)[0].trim().slice(0, 110);
}

export function formatDate(value: string, locale?: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

export function formatDateTime(value: string, locale?: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(locale);
}

export function formatFileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
