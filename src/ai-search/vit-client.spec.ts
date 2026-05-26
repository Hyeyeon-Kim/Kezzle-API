import { of, throwError } from 'rxjs';
import { VitClient } from './vit-client';

const buildMetricsService = () => ({
  aiApiCallDuration: { startTimer: jest.fn(() => jest.fn()) },
  aiApiErrors: { inc: jest.fn() },
});

describe('VitClient', () => {
  const originalVitBaseUrl = process.env.VIT_API_BASE_URL;

  beforeEach(() => {
    delete process.env.VIT_API_BASE_URL;
  });

  afterAll(() => {
    if (originalVitBaseUrl === undefined) {
      delete process.env.VIT_API_BASE_URL;
    } else {
      process.env.VIT_API_BASE_URL = originalVitBaseUrl;
    }
  });

  describe('similarSearchWithLocation', () => {
    it('builds URL with location params and returns unwrapped result', async () => {
      const expected = [{ id: 'cake-1' }, { id: 'cake-2' }];
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: expected } })),
      };
      const metricsService = buildMetricsService();
      const client = new VitClient(httpService as any, metricsService as any);

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

    it('uses VIT_API_BASE_URL env override when set', async () => {
      process.env.VIT_API_BASE_URL = 'http://kezzle-ai-server:8001';
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: [] } })),
      };
      const metricsService = buildMetricsService();
      const client = new VitClient(httpService as any, metricsService as any);

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
        aiApiCallDuration: { startTimer: jest.fn(() => endTimer) },
        aiApiErrors: { inc: jest.fn() },
      };
      const client = new VitClient(httpService as any, metricsService as any);

      await client.similarSearchWithLocation('id-1', 1, 2, 3, 4);

      expect(metricsService.aiApiCallDuration.startTimer).toHaveBeenCalledWith({
        model: 'vit',
        endpoint: 'similar-search',
      });
      expect(endTimer).toHaveBeenCalledWith({ status: 'success' });
      expect(metricsService.aiApiErrors.inc).not.toHaveBeenCalled();
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
        aiApiCallDuration: { startTimer: jest.fn(() => endTimer) },
        aiApiErrors: { inc: jest.fn() },
      };
      const client = new VitClient(httpService as any, metricsService as any);

      await expect(
        client.similarSearchWithLocation('id-1', 1, 2, 3, 4),
      ).rejects.toMatchObject({ code: 'ECONNABORTED' });

      expect(endTimer).toHaveBeenCalledWith({ status: 'timeout' });
      expect(metricsService.aiApiErrors.inc).toHaveBeenCalledWith({
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
      const client = new VitClient(httpService as any, metricsService as any);

      const result = await client.similarSearch('liked-cake-id', 6);

      expect(httpService.get).toHaveBeenCalledTimes(1);
      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.kezzlecake.com/vit/cakes/similar-search?id=liked-cake-id&size=6',
      );
      expect(result).toBe(expected);
    });

    it('records success metric with same labels as similarSearchWithLocation', async () => {
      const endTimer = jest.fn();
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: [] } })),
      };
      const metricsService = {
        aiApiCallDuration: { startTimer: jest.fn(() => endTimer) },
        aiApiErrors: { inc: jest.fn() },
      };
      const client = new VitClient(httpService as any, metricsService as any);

      await client.similarSearch('liked-cake-id', 6);

      expect(metricsService.aiApiCallDuration.startTimer).toHaveBeenCalledWith({
        model: 'vit',
        endpoint: 'similar-search',
      });
      expect(endTimer).toHaveBeenCalledWith({ status: 'success' });
    });
  });
});
