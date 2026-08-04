import {
  assertGrafanaProvisioning,
  requireHealthyTarget,
} from './observability-stack';
import { FetchImplementation, readResponseWithinDeadline } from './smoke-http';

describe('Observability smoke contracts', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('aborts a stalled fetch at the configured deadline', async () => {
    jest.useFakeTimers({ now: 1_000 });
    const stalledFetch: FetchImplementation = jest.fn((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });
    });

    const request = readResponseWithinDeadline(
      'http://prometheus.test/api/v1/targets',
      Date.now() + 250,
      async (response) => response,
      {},
      stalledFetch,
    );
    const rejection = expect(request).rejects.toThrow(
      'Request deadline exceeded after 250ms',
    );

    await jest.advanceTimersByTimeAsync(250);
    await rejection;
  });

  it('keeps the deadline active while reading a stalled body', async () => {
    jest.useFakeTimers({ now: 2_000 });
    const stalledBodyFetch: FetchImplementation = jest.fn((_input, init) => {
      return Promise.resolve({
        json: () =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new Error('body aborted'));
            });
          }),
      } as Response);
    });

    const request = readResponseWithinDeadline(
      'http://prometheus.test/api/v1/targets',
      Date.now() + 250,
      (response) => response.json(),
      {},
      stalledBodyFetch,
    );
    const rejection = expect(request).rejects.toThrow(
      'Request deadline exceeded after 250ms',
    );

    await jest.advanceTimersByTimeAsync(250);
    await rejection;
  });

  it('rejects missing or down exporter targets', () => {
    expect(() =>
      requireHealthyTarget([], 'mongodb', 'mongodb-exporter:9216/metrics'),
    ).toThrow('job=mongodb target was not found');
    expect(() =>
      requireHealthyTarget(
        [
          {
            labels: { job: 'redis' },
            health: 'down',
            scrapeUrl: 'http://redis-exporter:9121/metrics',
            lastError: 'connection refused',
          },
        ],
        'redis',
        'redis-exporter:9121/metrics',
      ),
    ).toThrow('job=redis target is not UP');
  });

  it('accepts an UP exporter target with the configured scrape URL', () => {
    expect(
      requireHealthyTarget(
        [
          {
            labels: { job: 'mongodb' },
            health: 'up',
            scrapeUrl: 'http://mongodb-exporter:9216/metrics',
            lastError: '',
          },
        ],
        'mongodb',
        'mongodb-exporter:9216/metrics',
      ),
    ).toMatchObject({ health: 'up' });
  });

  it('requires provisioned Grafana datasource and Home dashboard contracts', () => {
    expect(() =>
      assertGrafanaProvisioning(
        {
          uid: 'kezzle-prometheus',
          type: 'prometheus',
          url: 'http://prometheus:9090',
          readOnly: true,
        },
        {
          meta: { provisioned: false },
          dashboard: {
            uid: 'kezzle-home-api',
            title: 'Kezzle Home API',
            panels: [],
          },
        },
      ),
    ).toThrow('Grafana Home dashboard is not provisioned as expected');

    expect(() =>
      assertGrafanaProvisioning(
        {
          uid: 'kezzle-prometheus',
          type: 'prometheus',
          url: 'http://prometheus:9090',
          readOnly: true,
        },
        {
          meta: { provisioned: true, folderTitle: 'Kezzle' },
          dashboard: {
            uid: 'kezzle-home-api',
            title: 'Kezzle Home API',
            panels: [
              {
                datasource: {
                  type: 'prometheus',
                  uid: 'kezzle-prometheus',
                },
              },
            ],
          },
        },
      ),
    ).not.toThrow();
  });
});
