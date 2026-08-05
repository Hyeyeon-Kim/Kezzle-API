import { ReadinessState } from './readiness-state';

describe('ReadinessState', () => {
  it('moves from booting to ready and becomes unavailable before cleanup', () => {
    const state = new ReadinessState({ shutdownDrainMs: 0 } as never);

    expect(state.current).toBe('booting');
    expect(state.acceptsTraffic).toBe(false);

    state.markReady();
    expect(state.current).toBe('ready');
    expect(state.acceptsTraffic).toBe(true);

    state.onModuleDestroy();
    expect(state.current).toBe('shutting-down');
    expect(state.acceptsTraffic).toBe(false);
  });

  it('keeps the HTTP server drain window open for signal shutdown', async () => {
    jest.useFakeTimers();
    try {
      const state = new ReadinessState({ shutdownDrainMs: 25 } as never);
      state.markReady();

      const shutdown = state.beforeApplicationShutdown('SIGTERM');
      expect(state.acceptsTraffic).toBe(false);

      jest.advanceTimersByTime(24);
      let completed = false;
      void shutdown.then(() => {
        completed = true;
      });
      await Promise.resolve();
      expect(completed).toBe(false);

      jest.advanceTimersByTime(1);
      await shutdown;
      expect(completed).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not delay programmatic application close without a signal', async () => {
    const state = new ReadinessState({ shutdownDrainMs: 1000 } as never);

    await state.beforeApplicationShutdown();

    expect(state.current).toBe('shutting-down');
  });
});
