export type FetchImplementation = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export async function readResponseWithinDeadline<T>(
  input: string | URL,
  deadline: number,
  readResponse: (response: Response) => Promise<T>,
  init: RequestInit = {},
  fetchImplementation: FetchImplementation = fetch,
): Promise<T> {
  const timeoutMs = deadline - Date.now();
  if (timeoutMs <= 0) {
    throw new Error(`Request deadline already exceeded: ${input.toString()}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImplementation(input, {
      ...init,
      signal: controller.signal,
    });
    return await readResponse(response);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        `Request deadline exceeded after ${timeoutMs}ms: ${input.toString()}`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function waitWithinDeadline(
  deadline: number,
  intervalMs: number,
): Promise<void> {
  const waitMs = Math.min(intervalMs, Math.max(0, deadline - Date.now()));
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}
