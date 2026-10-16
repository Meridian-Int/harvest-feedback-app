import { parseAttachments, reportAttachments } from './attachments';

const file = { attachmentKey: 'feedback-media/a/1', attachmentName: 'one.png', attachmentType: 'image/png', attachmentSize: 5 };

it('parses attachment arrays and AWSJSON text, dropping malformed entries', () => {
  expect(parseAttachments([file, { attachmentKey: '' }, null])).toEqual([file]);
  expect(parseAttachments(JSON.stringify([file]))).toEqual([file]);
  expect(parseAttachments('not json')).toEqual([]);
  expect(parseAttachments(undefined)).toEqual([]);
});

it('lists every attachment, falling back to the legacy single-file fields', () => {
  const second = { ...file, attachmentKey: 'feedback-media/a/2', attachmentName: 'two.mp4' };
  expect(reportAttachments({ attachments: [file, second], ...file })).toEqual([file, second]);
  expect(reportAttachments({ ...file })).toEqual([file]);
  expect(reportAttachments({ attachmentName: 'lost.png' })).toEqual([{ attachmentKey: '', attachmentName: 'lost.png', attachmentType: '', attachmentSize: 0 }]);
  expect(reportAttachments({})).toEqual([]);
});
