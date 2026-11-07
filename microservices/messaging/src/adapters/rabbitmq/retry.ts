export const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 8000];

export type Sleep = (milliseconds: number) => Promise<void>;

const sleepFor: Sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function withRetries<T>(
  operation: () => Promise<T>,
  delaysMs: readonly number[] = RETRY_DELAYS_MS,
  sleep: Sleep = sleepFor,
): Promise<T> {
  for (const delayMs of delaysMs) {
    try {
      return await operation();
    } catch {
      await sleep(delayMs);
    }
  }
  return operation();
}
