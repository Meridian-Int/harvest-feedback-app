import { describe, expect, it } from 'vitest';
import { emptyDraft, severityForPriority, submissionDraft, titleFromDescription, validateDraft } from './form';
import { choices } from '../testing/support';

const valid = { productArea: 'Data room', customArea: '', priority: 'BUG', severity: 'LOW', description: '  download failed\nsecond line  ' };
describe('form validation', () => {
  it('combines missing fields in prototype focus order', () => {
    expect(validateDraft(emptyDraft(), choices)).toMatchObject({ first: 'description', message: 'Please describe your feedback, choose a priority, choose or name a category.' });
  });
  it('checks invalid options without guessing', () => {
    expect(validateDraft({ ...valid, priority: 'OTHER' }, choices).first).toBe('priority');
    expect(validateDraft({ ...valid, severity: 'BLOCKER' }, choices).message).toBe('');
    expect(validateDraft({ ...valid, productArea: 'removed' }, choices).first).toBe('productArea');
  });
  it('requires a trimmed custom area only for Other and enforces 80', () => {
    expect(validateDraft({ ...valid, productArea: 'Other', customArea: ' ' }, choices).first).toBe('customArea');
    expect(validateDraft({ ...valid, productArea: 'Other', customArea: 'x'.repeat(81) }, choices).first).toBe('customArea');
    expect(validateDraft({ ...valid, productArea: 'Other', customArea: 'x'.repeat(80) }, choices).message).toBe('');
    expect(validateDraft({ ...valid, customArea: 'x'.repeat(81) }, choices).message).toBe('');
  });
  it('permits 3000 trimmed characters and rejects 3001', () => {
    expect(validateDraft({ ...valid, description: 'x'.repeat(3000) }, choices).message).toBe('');
    expect(validateDraft({ ...valid, description: 'x'.repeat(3001) }, choices).first).toBe('description');
  });
  it('extracts the first line and caps at 110; normalizes the payload', () => {
    expect(titleFromDescription(valid.description)).toBe('download failed');
    expect(titleFromDescription('x'.repeat(111))).toHaveLength(110);
    expect(submissionDraft({ ...valid, customArea: 'unused' }, choices)).toMatchObject({ title: 'download failed', customArea: '', description: 'download failed\nsecond line' });
    expect(submissionDraft({ ...valid, productArea: 'Other', customArea: '  alerts  ' }, choices).customArea).toBe('alerts');
  });
});

it.each([['BLOCKER', 'CRITICAL'], ['BUG', 'MEDIUM'], ['IMPROVEMENT', 'LOW']])('derives legacy severity from %s without trusting the saved draft', (priority, severity) => {
  expect(severityForPriority(priority)).toBe(severity);
  expect(submissionDraft({ ...valid, priority, severity: 'invalid' }, choices).severity).toBe(severity);
});
