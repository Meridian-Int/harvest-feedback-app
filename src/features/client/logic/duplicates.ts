import type { Feedback } from '../contract';

const STOP_WORDS = new Set('the and this that with from have when what were was for are but not you your it its did does can could would should into after before then just'.split(' '));
export const significantWords = (text: string) => new Set((text.toLowerCase().match(/[a-z0-9]+/g) || []).filter(word => word.length > 2 && !STOP_WORDS.has(word)));
// Only accepts the owner-authorized list returned by listMyFeedback.
export function findDuplicates(description: string, area: string, myReports: Feedback[]): Feedback[] {
  const query = significantWords(description);
  if (query.size < 3 || !area) return [];
  return myReports.map(report => {
    const tokens = significantWords(`${report.title} ${report.description}`);
    const shared = [...query].filter(word => tokens.has(word)).length;
    return { report, shared, score: shared / Math.min(query.size, tokens.size || 1) };
  }).filter(match => (match.report.customArea || match.report.productArea) === area && match.shared >= 3 && match.score >= 0.4)
    .sort((a, b) => b.score - a.score).slice(0, 3).map(match => match.report);
}
