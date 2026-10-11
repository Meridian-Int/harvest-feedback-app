export function request(ctx) {
  // Submission emails now originate from committed table events. This legacy
  // pipeline invokes a no-op so deployment does not duplicate admin emails.
  return {
    operation: 'Invoke',
    payload: { deliveryHandledByStream: true },
  };
}

export function response(ctx) {
  // A mail outage must never turn a successfully saved report into a failed
  // submission, which could make the client retry and create a duplicate.
  return ctx.stash.submittedFeedback;
}
