import { homeConfigFixture } from '../../../../../test/support/typed-config.fixtures';
import { RedisHomeCacheAdapter } from './redis-home-cache.adapter';

describe('RedisHomeCacheAdapter', () => {
  const key = 'home:v2:test';
  let redis: {
    status: string;
    on: jest.Mock;
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    eval: jest.Mock;
    quit: jest.Mock;
    disconnect: jest.Mock;
    removeAllListeners: jest.Mock;
  };
  let metrics: { countCache: jest.Mock };

  beforeEach(() => {
    redis = {
      status: 'ready',
      on: jest.fn(),
      get: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      eval: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn(),
      removeAllListeners: jest.fn(),
    };
    metrics = { countCache: jest.fn() };
  });

  function service(
    client: typeof redis | null = redis,
    config: any = homeConfigFixture,
  ) {
    return new RedisHomeCacheAdapter(client as never, metrics as never, config);
  }

  function options(refresh = jest.fn().mockResolvedValue('origin')) {
    return {
      keySuffix: 'test',
      policy: 'recommend' as const,
      refresh,
    };
  }

  it('returns a fresh hit without calling the origin', async () => {
    const refresh = jest.fn().mockResolvedValue('origin');
    redis.get.mockResolvedValue(
      JSON.stringify({
        value: 'cached',
        freshUntil: Date.now() + 1_000,
        staleUntil: Date.now() + 10_000,
      }),
    );

    await expect(service().getWithSwr(options(refresh))).resolves.toBe(
      'cached',
    );
    expect(refresh).not.toHaveBeenCalled();
    expect(metrics.countCache).toHaveBeenCalledWith('fresh_hit');
  });

  it('loads and stores a cache miss', async () => {
    redis.get.mockResolvedValue(null);
    const config = {
      ...homeConfigFixture,
      cache: {
        ...homeConfigFixture.cache,
        jitterPercent: 0,
        policies: {
          ...homeConfigFixture.cache.policies,
          recommend: { freshTtlMs: 1_000, staleTtlMs: 10_000 },
        },
      },
    };
    await expect(service(redis, config).getWithSwr(options())).resolves.toBe(
      'origin',
    );

    expect(metrics.countCache).toHaveBeenCalledWith('miss');
    expect(metrics.countCache).toHaveBeenCalledWith('refresh');
    expect(redis.set).toHaveBeenCalledWith(
      key,
      expect.any(String),
      'PX',
      10_000,
    );
    const envelope = JSON.parse(redis.set.mock.calls[0][1]);
    expect(envelope.freshUntil - Date.now()).toBeGreaterThan(900);
  });

  it('returns stale data and refreshes once behind a lock', async () => {
    const refresh = jest.fn().mockResolvedValue('refreshed');
    redis.get.mockResolvedValue(
      JSON.stringify({
        value: 'stale',
        freshUntil: Date.now() - 1,
        staleUntil: Date.now() + 10_000,
      }),
    );

    await expect(service().getWithSwr(options(refresh))).resolves.toBe('stale');
    await new Promise((resolve) => setImmediate(resolve));

    expect(redis.set).toHaveBeenCalledWith(
      `${key}:lock`,
      expect.any(String),
      'PX',
      10_000,
      'NX',
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(redis.eval).toHaveBeenCalledTimes(1);
  });

  it('does not refresh stale data when another worker owns the lock', async () => {
    const refresh = jest.fn().mockResolvedValue('refreshed');
    redis.get.mockResolvedValue(
      JSON.stringify({
        value: 'stale',
        freshUntil: Date.now() - 1,
        staleUntil: Date.now() + 10_000,
      }),
    );
    redis.set.mockResolvedValue(null);

    await service().getWithSwr(options(refresh));
    await new Promise((resolve) => setImmediate(resolve));

    expect(refresh).not.toHaveBeenCalled();
  });

  it('falls back to the origin when Redis fails', async () => {
    redis.get.mockRejectedValue(new Error('Redis unavailable'));

    await expect(service().getWithSwr(options())).resolves.toBe('origin');
    expect(metrics.countCache).toHaveBeenCalledWith('error');
  });

  it('deletes an invalid envelope and treats it as a miss', async () => {
    redis.get.mockResolvedValue('{invalid-json');

    await expect(service().getWithSwr(options())).resolves.toBe('origin');

    expect(redis.del).toHaveBeenCalledWith(key);
    expect(metrics.countCache).toHaveBeenCalledWith('miss');
    expect(metrics.countCache).not.toHaveBeenCalledWith('error');
  });

  it('bypasses caching when REDIS_URL is not configured', async () => {
    const refresh = jest.fn().mockResolvedValue('origin');

    await expect(service(null).getWithSwr(options(refresh))).resolves.toBe(
      'origin',
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(metrics.countCache).not.toHaveBeenCalled();
  });

  it('reports optional Redis health without affecting origin fallback policy', () => {
    expect(service(null).healthStatus()).toBe('disabled');
    expect(service().healthStatus()).toBe('up');

    redis.status = 'reconnecting';
    expect(service().healthStatus()).toBe('down');
  });

  it('quits Redis and removes listeners during shutdown', async () => {
    const cache = service();

    await cache.onApplicationShutdown();

    expect(redis.quit).toHaveBeenCalledTimes(1);
    expect(redis.disconnect).not.toHaveBeenCalled();
    expect(redis.removeAllListeners).toHaveBeenCalledTimes(1);
  });

  it('forces disconnect when quit exceeds the shutdown limit', async () => {
    redis.quit.mockReturnValue(new Promise(() => undefined));
    const config = {
      ...homeConfigFixture,
      cache: { ...homeConfigFixture.cache, commandTimeoutMs: 20 },
    };
    const cache = service(redis, config);

    await cache.onApplicationShutdown();

    expect(redis.quit).toHaveBeenCalledTimes(1);
    expect(redis.disconnect).toHaveBeenCalledTimes(1);
    expect(redis.removeAllListeners).toHaveBeenCalledTimes(1);
  });

  it('forces disconnect when quit rejects during shutdown', async () => {
    redis.quit.mockRejectedValue(new Error('quit failed'));
    const cache = service();

    await cache.onApplicationShutdown();

    expect(redis.disconnect).toHaveBeenCalledTimes(1);
    expect(redis.removeAllListeners).toHaveBeenCalledTimes(1);
  });
});
