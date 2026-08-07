import { of, throwError } from 'rxjs';
import { VitHttpAdapter } from './vit-http.adapter';

const buildMetricsService = () => ({
  startCall: jest.fn(() => jest.fn()),
  countError: jest.fn(),
});
const AI_CONFIG = {
  vitBaseUrl: 'https://api.kezzlecake.com/vit',
  clipBaseUrl: 'https://api.kezzlecake.com/clip',
  httpTimeoutMs: 5000,
};

describe('VitHttpAdapter', () => {
  describe('similarSearchWithLocation', () => {
    it('builds URL with location params and returns unwrapped result', async () => {
      const expected = [{ id: 'cake-1' }, { id: 'cake-2' }];
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: expected } })),
      };
      const metricsService = buildMetricsService();
      const client = new VitHttpAdapter(
        httpService as any,
        metricsService as any,
        AI_CONFIG,
      );

      const result = await client.similarSearchWithLocation(
        'mock-cake-id',
        127.01,
        37.01,
        3000,
        6,
      );

      expect(httpService.get).toHaveBeenCalledTimes(1);
      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.kezzlecake.com/vit/cakes/similar-search?id=mock-cake-id&lon=127.01&lat=37.01&dist=3000&size=6',
      );
      expect(result).toEqual([
        expect.objectContaining({ id: 'cake-1' }),
        expect.objectContaining({ id: 'cake-2' }),
      ]);
    });

    it('uses the injected VIT base URL', async () => {
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: [] } })),
      };
      const metricsService = buildMetricsService();
      const client = new VitHttpAdapter(
        httpService as any,
        metricsService as any,
        {
          ...AI_CONFIG,
          vitBaseUrl: 'http://kezzle-ai-server:8001',
        },
      );

      await client.similarSearchWithLocation('id-1', 1, 2, 3, 4);

      expect(httpService.get).toHaveBeenCalledWith(
        'http://kezzle-ai-server:8001/cakes/similar-search?id=id-1&lon=1&lat=2&dist=3&size=4',
      );
    });

    it('passes the caller AbortSignal to the location request', async () => {
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: [] } })),
      };
      const client = new VitHttpAdapter(
        httpService as any,
        buildMetricsService() as any,
        AI_CONFIG,
      );
      const controller = new AbortController();

      await client.similarSearchWithLocation(
        'id-1',
        1,
        2,
        3,
        4,
        controller.signal,
      );

      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.kezzlecake.com/vit/cakes/similar-search?id=id-1&lon=1&lat=2&dist=3&size=4',
        { signal: controller.signal },
      );
    });

    it('records success metric with model=vit and endpoint=similar-search', async () => {
      const endTimer = jest.fn();
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: [] } })),
      };
      const metricsService = {
        startCall: jest.fn(() => endTimer),
        countError: jest.fn(),
      };
      const client = new VitHttpAdapter(
        httpService as any,
        metricsService as any,
        AI_CONFIG,
      );

      await client.similarSearchWithLocation('id-1', 1, 2, 3, 4);

      expect(metricsService.startCall).toHaveBeenCalledWith({
        model: 'vit',
        endpoint: 'similar-search',
      });
      expect(endTimer).toHaveBeenCalledWith('success');
      expect(metricsService.countError).not.toHaveBeenCalled();
    });

    it('records timeout error metric when call fails with ECONNABORTED', async () => {
      const endTimer = jest.fn();
      const httpService = {
        get: jest
          .fn()
          .mockReturnValue(
            throwError(() => ({ code: 'ECONNABORTED', message: 'timeout' })),
          ),
      };
      const metricsService = {
        startCall: jest.fn(() => endTimer),
        countError: jest.fn(),
      };
      const client = new VitHttpAdapter(
        httpService as any,
        metricsService as any,
        AI_CONFIG,
      );

      await expect(
        client.similarSearchWithLocation('id-1', 1, 2, 3, 4),
      ).rejects.toMatchObject({ code: 'ECONNABORTED' });

      expect(endTimer).toHaveBeenCalledWith('timeout');
      expect(metricsService.countError).toHaveBeenCalledWith({
        reason: 'timeout',
        model: 'vit',
        endpoint: 'similar-search',
      });
    });

    it('keeps caller cancellation in the existing error metric label', async () => {
      const endTimer = jest.fn();
      const httpService = {
        get: jest
          .fn()
          .mockReturnValue(
            throwError(() => ({ code: 'ERR_CANCELED', message: 'canceled' })),
          ),
      };
      const metricsService = {
        startCall: jest.fn(() => endTimer),
        countError: jest.fn(),
      };
      const client = new VitHttpAdapter(
        httpService as any,
        metricsService as any,
        AI_CONFIG,
      );
      const controller = new AbortController();

      await expect(
        client.similarSearchWithLocation('id-1', 1, 2, 3, 4, controller.signal),
      ).rejects.toMatchObject({ code: 'ERR_CANCELED' });

      expect(endTimer).toHaveBeenCalledWith('error');
      expect(metricsService.countError).toHaveBeenCalledWith({
        reason: 'error',
        model: 'vit',
        endpoint: 'similar-search',
      });
    });
  });

  describe('similarSearch', () => {
    it('builds URL without location params and returns unwrapped result', async () => {
      const expected = [{ id: 'cake-1' }];
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: expected } })),
      };
      const metricsService = buildMetricsService();
      const client = new VitHttpAdapter(
        httpService as any,
        metricsService as any,
        AI_CONFIG,
      );

      const result = await client.similarSearch('liked-cake-id', 6);

      expect(httpService.get).toHaveBeenCalledTimes(1);
      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.kezzlecake.com/vit/cakes/similar-search?id=liked-cake-id&size=6',
      );
      expect(result).toEqual([
        expect.objectContaining({
          id: 'cake-1',
          likedUserIds: [],
          tags: [],
          isDeleted: false,
        }),
      ]);
    });

    it('encodes id query parameter safely', async () => {
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: [] } })),
      };
      const metricsService = buildMetricsService();
      const client = new VitHttpAdapter(
        httpService as any,
        metricsService as any,
        AI_CONFIG,
      );

      await client.similarSearch('cake id/한글', 6);

      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.kezzlecake.com/vit/cakes/similar-search?id=cake+id%2F%ED%95%9C%EA%B8%80&size=6',
      );
    });

    it('passes the caller AbortSignal to the request', async () => {
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: [] } })),
      };
      const client = new VitHttpAdapter(
        httpService as any,
        buildMetricsService() as any,
        AI_CONFIG,
      );
      const controller = new AbortController();

      await client.similarSearch('liked-cake-id', 6, controller.signal);

      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.kezzlecake.com/vit/cakes/similar-search?id=liked-cake-id&size=6',
        { signal: controller.signal },
      );
    });

    it('records success metric with same labels as similarSearchWithLocation', async () => {
      const endTimer = jest.fn();
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: [] } })),
      };
      const metricsService = {
        startCall: jest.fn(() => endTimer),
        countError: jest.fn(),
      };
      const client = new VitHttpAdapter(
        httpService as any,
        metricsService as any,
        AI_CONFIG,
      );

      await client.similarSearch('liked-cake-id', 6);

      expect(metricsService.startCall).toHaveBeenCalledWith({
        model: 'vit',
        endpoint: 'similar-search',
      });
      expect(endTimer).toHaveBeenCalledWith('success');
    });
  });
});
