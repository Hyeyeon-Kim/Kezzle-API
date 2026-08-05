import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { Registry } from 'prom-client';
import { AiSearchModule } from 'src/integrations/ai-search/ai-search.module';
import { ClipClient } from 'src/integrations/ai-search/clip-client';
import { VitClient } from 'src/integrations/ai-search/vit-client';
import aiConfig from 'src/platform/config/ai.config';
import { PROMETHEUS_REGISTRY } from 'src/platform/observability/prometheus/prometheus.constants';

describe('AI shared HTTP timeout contract (e2e)', () => {
  let server: Server;
  let module: TestingModule;
  let vitClient: VitClient;
  let clipClient: ClipClient;
  let registry: Registry;

  beforeAll(async () => {
    server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://mock-ai');
      const requestKey =
        url.searchParams.get('id') ?? url.searchParams.get('keyword');

      if (requestKey === 'general-error') {
        request.socket.destroy(new Error('mock AI connection failure'));
        return;
      }

      const respond = () => {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(
          JSON.stringify({ result: [], nextPage: 1, isLastPage: true }),
        );
      };
      if (requestKey === 'slow' || requestKey === 'caller-abort') {
        setTimeout(respond, 200);
        return;
      }
      respond();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const port = (server.address() as AddressInfo).port;

    module = await Test.createTestingModule({ imports: [AiSearchModule] })
      .overrideProvider(aiConfig.KEY)
      .useValue({
        vitBaseUrl: `http://127.0.0.1:${port}/vit`,
        clipBaseUrl: `http://127.0.0.1:${port}/clip`,
        httpTimeoutMs: 50,
      })
      .compile();
    vitClient = module.get(VitClient);
    clipClient = module.get(ClipClient);
    registry = module.get(PROMETHEUS_REGISTRY);
  });

  afterAll(async () => {
    await module.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it('bounds signal-less calls and preserves timeout/error metric labels', async () => {
    expect(module.get(HttpService).axiosRef.defaults.timeout).toBe(50);
    await expect(vitClient.similarSearch('normal', 1)).resolves.toEqual([]);

    await expect(vitClient.similarSearch('slow', 1)).rejects.toMatchObject({
      code: 'ECONNABORTED',
    });

    const controller = new AbortController();
    const canceled = clipClient.koSearch('caller-abort', 1, controller.signal);
    controller.abort();
    await expect(canceled).rejects.toMatchObject({ code: 'ERR_CANCELED' });

    await expect(
      clipClient.koSearchPage('general-error', 1, 0),
    ).rejects.toMatchObject({ code: 'ECONNRESET' });

    const metrics = await registry.metrics();
    expect(metrics).toContain(
      'ai_api_errors_total{reason="timeout",model="vit",endpoint="similar-search"} 1',
    );
    expect(metrics).toContain(
      'ai_api_errors_total{reason="error",model="clip",endpoint="ko-search"} 1',
    );
    expect(metrics).toContain(
      'ai_api_errors_total{reason="error",model="clip",endpoint="ko-search-page"} 1',
    );
    const reasons = [
      ...metrics.matchAll(/ai_api_errors_total\{reason="([^"]+)"/g),
    ]
      .map((match) => match[1])
      .sort();
    expect([...new Set(reasons)]).toEqual(['error', 'timeout']);
  });
});
