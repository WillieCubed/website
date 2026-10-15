/** Bound network and body reads while preserving a caller's cancellation. */
export function fetchWithDeadline(
  input: RequestInfo | URL,
  init: RequestInit = {},
  milliseconds = 10_000
): Promise<Response> {
  const deadline = AbortSignal.timeout(milliseconds);
  const signal = init.signal
    ? AbortSignal.any([init.signal, deadline])
    : deadline;
  return fetch(input, { ...init, signal });
}
