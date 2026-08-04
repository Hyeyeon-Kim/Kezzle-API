import { of, throwError } from 'rxjs';
import { VitClient } from './vit-client';

const buildMetricsService = () => ({
  startCall: jest.fn(() => jest.fn()),
  countError: jest.fn(),
});
const AI_CONFIG = {
  vitBaseUrl: 'https://api.kezzlecake.com/vit',
  clipBaseUrl: 'https://api.kezzlecake.com/clip',
  httpTimeoutMs: 5000,
};

describe('VitClient', () => {
  describe('similarSearchWithLocation', () => {
    it('builds URL with location params and returns unwrapped result', async () => {
      const expected = [{ id: 'cake-1' }, { id: 'cake-2' }];
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: expected } })),
      };
      const metricsService = buildMetricsService();
      const client = new VitClient(
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
      expect(result).toBe(expected);
    });

    it('uses the injected VIT base URL', async () => {
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: [] } })),
      };
      const metricsService = buildMetricsService();
      const client = new VitClient(httpService as any, metricsService as any, {
        ...AI_CONFIG,
        vitBaseUrl: 'http://kezzle-ai-server:8001',
      });

      await client.similarSearchWithLocation('id-1', 1, 2, 3, 4);

      expect(httpService.get).toHaveBeenCalledWith(
        'http://kezzle-ai-server:8001/cakes/similar-search?id=id-1&lon=1&lat=2&dist=3&size=4',
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
      const client = new VitClient(
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
      const client = new VitClient(
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
  });

  describe('similarSearch', () => {
    it('builds URL without location params and returns unwrapped result', async () => {
      const expected = [{ id: 'cake-1' }];
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: expected } })),
      };
      const metricsService = buildMetricsService();
      const client = new VitClient(
        httpService as any,
        metricsService as any,
        AI_CONFIG,
      );

      const result = await client.similarSearch('liked-cake-id', 6);

      expect(httpService.get).toHaveBeenCalledTimes(1);
      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.kezzlecake.com/vit/cakes/similar-search?id=liked-cake-id&size=6',
      );
      expect(result).toBe(expected);
    });

    it('encodes id query parameter safely', async () => {
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: [] } })),
      };
      const metricsService = buildMetricsService();
      const client = new VitClient(
        httpService as any,
        metricsService as any,
        AI_CONFIG,
      );

      await client.similarSearch('cake id/한글', 6);

      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.kezzlecake.com/vit/cakes/similar-search?id=cake+id%2F%ED%95%9C%EA%B8%80&size=6',
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
      const client = new VitClient(
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
