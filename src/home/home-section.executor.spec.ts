import { executeHomeSection, startHomeDeadline } from './home-section.executor';

describe('executeHomeSection', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns a successful result and clears the timeout timer', async () => {
    jest.useFakeTimers();

    const result = await executeHomeSection({
      name: 'popularCakes',
      timeoutMs: 50,
      fallback: [],
      operation: async () => ['cake'],
    });

    expect(result).toMatchObject({ status: 'success', data: ['cake'] });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('aborts the dependency and returns a timeout fallback', async () => {
    jest.useFakeTimers();
    let dependencySignal: AbortSignal | undefined;

    const resultPromise = executeHomeSection({
      name: 'recommendCakes',
      timeoutMs: 250,
      fallback: [],
      operation: (signal) => {
        dependencySignal = signal;
        return new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            reject(new Error('dependency aborted'));
          });
        });
      },
    });

    jest.advanceTimersByTime(250);
    const result = await resultPromise;

    expect(dependencySignal?.aborted).toBe(true);
    expect(result).toMatchObject({
      status: 'fallback',
      reason: 'timeout',
      data: [],
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('converts a dependency error to a fallback', async () => {
    const error = new Error('dependency failed');
    const onError = jest.fn();

    const result = await executeHomeSection({
      name: 'anniversary',
      timeoutMs: 250,
      fallback: { images: [] },
      operation: async () => {
        throw error;
      },
      onError,
    });

    expect(result).toMatchObject({
      status: 'fallback',
      reason: 'dependency_error',
      data: { images: [] },
    });
    expect(onError).toHaveBeenCalledWith(error, 'dependency_error');
  });

  it('aborts all unfinished sections at the hard deadline', async () => {
    jest.useFakeTimers();
    const deadline = startHomeDeadline(600);
    const expired = jest.fn();
    void deadline.expired.then(expired);

    jest.advanceTimersByTime(600);
    await Promise.resolve();

    expect(deadline.signal.aborted).toBe(true);
    expect(expired).toHaveBeenCalled();
  });
});
