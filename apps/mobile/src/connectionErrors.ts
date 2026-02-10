const THREAD_UNAVAILABLE_PATTERNS = [
  /missing rollout path/i,
  /thread .* not found/i,
  /unknown thread/i,
  /thread .* unavailable/i,
] as const;

export function isThreadUnavailableError(message: string): boolean {
  return THREAD_UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(message));
}

