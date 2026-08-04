import { readResponseWithinDeadline, waitWithinDeadline } from './smoke-http';

type PrometheusTarget = {
  readonly discoveredLabels?: Record<string, string>;
  readonly labels?: Record<string, string>;
  readonly scrapeUrl?: string;
  readonly health?: string;
  readonly lastError?: string;
  readonly lastScrape?: string;
};

type PrometheusTargetsResponse = {
  readonly status?: string;
  readonly data?: {
    readonly activeTargets?: PrometheusTarget[];
  };
};

const prometheusUrl = (
  process.env.PROMETHEUS_URL ?? 'http://127.0.0.1:9090'
).replace(/\/$/, '');
const targetJob = process.env.PROMETHEUS_TARGET_JOB ?? 'kezzle-api';
const timeoutMs = positiveNumber(
  process.env.PROMETHEUS_SMOKE_TIMEOUT_MS,
  30_000,
);
const pollIntervalMs = 1_000;

async function main(): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastFailure = 'target not observed';

  while (Date.now() < deadline) {
    try {
      const result = await readResponseWithinDeadline(
        `${prometheusUrl}/api/v1/targets`,
        deadline,
        async (response) => ({
          ok: response.ok,
          status: response.status,
          payload: (await response.json()) as PrometheusTargetsResponse,
        }),
      );
      if (!result.ok) {
        throw new Error(`Prometheus returned HTTP ${result.status}`);
      }

      const payload = result.payload;
      const target = payload.data?.activeTargets?.find(
        (candidate) =>
          candidate.labels?.job === targetJob ||
          candidate.discoveredLabels?.__meta_job === targetJob ||
          candidate.discoveredLabels?.job === targetJob,
      );

      if (!target) {
        lastFailure = `job=${targetJob} target not found`;
      } else if (target.health !== 'up') {
        lastFailure = `job=${targetJob} health=${
          target.health ?? 'unknown'
        } lastError=${target.lastError ?? ''}`;
      } else if (!target.scrapeUrl?.endsWith('/metrics')) {
        lastFailure = `job=${targetJob} unexpected scrapeUrl=${
          target.scrapeUrl ?? ''
        }`;
      } else {
        console.log(
          JSON.stringify({
            prometheusUrl,
            job: targetJob,
            health: target.health,
            scrapeUrl: target.scrapeUrl,
            lastError: target.lastError ?? '',
            lastScrape: target.lastScrape ?? '',
          }),
        );
        return;
      }
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    await waitWithinDeadline(deadline, pollIntervalMs);
  }

  throw new Error(
    `Prometheus target smoke failed after ${timeoutMs}ms: ${lastFailure}`,
  );
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
