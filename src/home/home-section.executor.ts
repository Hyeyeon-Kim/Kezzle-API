export type HomeSectionStatus = 'success' | 'fallback';

export type HomeSectionFallbackReason = 'timeout' | 'dependency_error';

export type HomeSectionResult<T> =
  | {
      status: 'success';
      data: T;
      durationMs: number;
    }
  | {
      status: 'fallback';
      data: T;
      reason: HomeSectionFallbackReason;
      durationMs: number;
    };

type ExecuteHomeSectionOptions<T> = {
  name: string;
  timeoutMs: number;
  fallback: T;
  operation: (signal: AbortSignal) => Promise<T>;
  parentSignal?: AbortSignal;
  onError?: (error: unknown, reason: HomeSectionFallbackReason) => void;
};

class HomeSectionTimeoutError extends Error {
  constructor(name: string, timeoutMs: number) {
    super(`${name} section exceeded ${timeoutMs}ms`);
    this.name = HomeSectionTimeoutError.name;
  }
}

export type HomeDeadline = {
  signal: AbortSignal;
  expired: Promise<void>;
  timeoutMs: number;
  clear(): void;
};

export function startHomeDeadline(timeoutMs: number): HomeDeadline {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;

  const expired = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve();
    }, timeoutMs);
  });

  return {
    signal: controller.signal,
    expired,
    timeoutMs,
    clear() {
      if (timer) clearTimeout(timer);
    },
  };
}

export async function executeHomeSection<T>({
  name,
  timeoutMs,
  fallback,
  operation,
  parentSignal,
  onError,
}: ExecuteHomeSectionOptions<T>): Promise<HomeSectionResult<T>> {
  const controller = new AbortController();
  const startedAt = process.hrtime.bigint();
  let timer: NodeJS.Timeout | undefined;

  const abortFromParent = () => controller.abort();
  if (parentSignal?.aborted) {
    controller.abort();
  } else {
    parentSignal?.addEventListener('abort', abortFromParent, { once: true });
  }

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new HomeSectionTimeoutError(name, timeoutMs));
    }, timeoutMs);
  });

  try {
    const data = await Promise.race([operation(controller.signal), timeout]);
    return {
      status: 'success',
      data,
      durationMs: elapsedMs(startedAt),
    };
  } catch (error) {
    const reason: HomeSectionFallbackReason =
      error instanceof HomeSectionTimeoutError || controller.signal.aborted
        ? 'timeout'
        : 'dependency_error';
    onError?.(error, reason);
    return {
      status: 'fallback',
      data: fallback,
      reason,
      durationMs: elapsedMs(startedAt),
    };
  } finally {
    if (timer) clearTimeout(timer);
    parentSignal?.removeEventListener('abort', abortFromParent);
  }
}

function elapsedMs(startedAt: bigint): number {
  const duration = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  return Math.round(duration * 100) / 100;
}
