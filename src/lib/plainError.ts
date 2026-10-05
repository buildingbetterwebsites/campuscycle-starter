// An error whose message already says everything you need: what went wrong and what to do about it.
// The seed runner (scripts/seed.mjs) prints only the message of such an error, without the long list
// of code lines (the "stack") under it, which would only bury the message. Set DEBUG=1 to see the
// stack too. Unexpected errors always keep their stack: that is what you need to find their cause.
export class PlainError extends Error {
  // scripts/seed.mjs recognises it by this name.
  override name = 'PlainError'
}
