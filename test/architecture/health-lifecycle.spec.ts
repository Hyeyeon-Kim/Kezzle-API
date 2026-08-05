import { readFileSync } from 'fs';
import { resolve } from 'path';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('health and shutdown architecture', () => {
  it('keeps both health routes public and outside Swagger', () => {
    const controller = source('src/health/health.controller.ts');

    expect(controller.match(/@Public\(\)/g)).toHaveLength(2);
    expect(controller).toContain('@ApiExcludeController()');
    expect(controller).toContain("@Get('live')");
    expect(controller).toContain("@Get('ready')");
  });

  it('enables shutdown hooks and only marks readiness after listen resolves', () => {
    const main = source('src/main.ts');
    const listen = main.indexOf('await app.listen(application.port)');
    const ready = main.indexOf('readiness.markReady()');

    expect(main).toContain('app.enableShutdownHooks()');
    expect(listen).toBeGreaterThan(-1);
    expect(ready).toBeGreaterThan(listen);
  });

  it('keeps Mongo required and Redis optional/degraded in readiness policy', () => {
    const health = source('src/health/health.service.ts');

    expect(health).toContain("mongo === 'down'");
    expect(health).toContain("redis === 'down'");
    expect(health).toContain("? 'degraded'");
  });

  it('ships the API image with a readiness healthcheck and SIGTERM signal', () => {
    const dockerfile = source('Dockerfile');

    expect(dockerfile).toContain('STOPSIGNAL SIGTERM');
    expect(dockerfile).toContain('/health/ready');
  });
});
