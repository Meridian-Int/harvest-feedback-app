export function request(ctx) {
  const report = ctx.stash.submittedFeedback;
  return {
    operation: 'Invoke',
    payload: {
      id: report.id,
      title: report.title,
      company: report.company,
      persona: report.persona,
      sentryIssueId: report.sentryIssueId,
    },
  };
}

export function response(ctx) {
  // A mail outage must never turn a successfully saved report into a failed
  // submission, which could make the client retry and create a duplicate.
  return ctx.stash.submittedFeedback;
}
