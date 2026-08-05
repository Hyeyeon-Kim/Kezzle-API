import { of, throwError } from 'rxjs';
import { ClipClient } from './clip-client';

const buildMetricsService = () => ({
  startCall: jest.fn(() => jest.fn()),
  countError: jest.fn(),
});
const AI_CONFIG = {
  vitBaseUrl: 'https://api.kezzlecake.com/vit',
  clipBaseUrl: 'https://api.kezzlecake.com/clip',
  httpTimeoutMs: 5000,
};

describe('ClipClient', () => {
  describe('koSearch', () => {
    it('builds URL and returns unwrapped result', async () => {
      const expected = [{ id: 'cake-1' }];
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: expected } })),
      };
      const metricsService = buildMetricsService();
      const client = new ClipClient(
        httpService as any,
        metricsService as any,
        AI_CONFIG,
      );

      const result = await client.koSearch('생일', 100);

      expect(httpService.get).toHaveBeenCalledTimes(1);
      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.kezzlecake.com/clip/cakes/ko-search?keyword=%EC%83%9D%EC%9D%BC&size=100',
      );
      expect(result).toBe(expected);
    });

    it('encodes keyword query parameter safely', async () => {
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: [] } })),
      };
      const metricsService = buildMetricsService();
      const client = new ClipClient(
        httpService as any,
        metricsService as any,
        AI_CONFIG,
      );

      await client.koSearch('딸기, 초코 & cream', 100);

      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.kezzlecake.com/clip/cakes/ko-search?keyword=%EB%94%B8%EA%B8%B0%2C+%EC%B4%88%EC%BD%94+%26+cream&size=100',
      );
    });

    it('passes the caller AbortSignal to the request', async () => {
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: [] } })),
      };
      const client = new ClipClient(
        httpService as any,
        buildMetricsService() as any,
        AI_CONFIG,
      );
      const controller = new AbortController();

      await client.koSearch('test', 6, controller.signal);

      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.kezzlecake.com/clip/cakes/ko-search?keyword=test&size=6',
        { signal: controller.signal },
      );
    });

    it('uses the injected CLIP base URL', async () => {
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: [] } })),
      };
      const metricsService = buildMetricsService();
      const client = new ClipClient(httpService as any, metricsService as any, {
        ...AI_CONFIG,
        clipBaseUrl: 'http://kezzle-clip-server:8002',
      });

      await client.koSearch('test', 6);

      expect(httpService.get).toHaveBeenCalledWith(
        'http://kezzle-clip-server:8002/cakes/ko-search?keyword=test&size=6',
      );
    });

    it('records success metric with model=clip and endpoint=ko-search', async () => {
      const endTimer = jest.fn();
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: [] } })),
      };
      const metricsService = {
        startCall: jest.fn(() => endTimer),
        countError: jest.fn(),
      };
      const client = new ClipClient(
        httpService as any,
        metricsService as any,
        AI_CONFIG,
      );

      await client.koSearch('test', 6);

      expect(metricsService.startCall).toHaveBeenCalledWith({
        model: 'clip',
        endpoint: 'ko-search',
      });
      expect(endTimer).toHaveBeenCalledWith('success');
    });

    it('records error metric when call fails', async () => {
      const endTimer = jest.fn();
      const httpService = {
        get: jest.fn().mockReturnValue(throwError(() => ({ message: 'boom' }))),
      };
      const metricsService = {
        startCall: jest.fn(() => endTimer),
        countError: jest.fn(),
      };
      const client = new ClipClient(
        httpService as any,
        metricsService as any,
        AI_CONFIG,
      );

      await expect(client.koSearch('test', 6)).rejects.toMatchObject({
        message: 'boom',
      });

      expect(endTimer).toHaveBeenCalledWith('error');
      expect(metricsService.countError).toHaveBeenCalledWith({
        reason: 'error',
        model: 'clip',
        endpoint: 'ko-search',
      });
    });
  });

  describe('koSearchPage', () => {
    it('builds URL with page param and returns full pagination payload', async () => {
      const result = [{ id: 'cake-1' }];
      const httpService = {
        get: jest.fn().mockReturnValue(
          of({
            data: { result, nextPage: 2, isLastPage: false },
          }),
        ),
      };
      const metricsService = buildMetricsService();
      const client = new ClipClient(
        httpService as any,
        metricsService as any,
        AI_CONFIG,
      );

      const response = await client.koSearchPage('딸기', 20, 1);

      expect(httpService.get).toHaveBeenCalledTimes(1);
      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.kezzlecake.com/clip/cakes/ko-search-page?keyword=%EB%94%B8%EA%B8%B0&size=20&page=1',
      );
      expect(response.result).toBe(result);
      expect(response.nextPage).toBe(2);
      expect(response.isLastPage).toBe(false);
    });

    it('records success metric with model=clip and endpoint=ko-search-page', async () => {
      const endTimer = jest.fn();
      const httpService = {
        get: jest
          .fn()
          .mockReturnValue(of({ data: { result: [], nextPage: 2 } })),
      };
      const metricsService = {
        startCall: jest.fn(() => endTimer),
        countError: jest.fn(),
      };
      const client = new ClipClient(
        httpService as any,
        metricsService as any,
        AI_CONFIG,
      );

      await client.koSearchPage('keyword', 20, 0);

      expect(metricsService.startCall).toHaveBeenCalledWith({
        model: 'clip',
        endpoint: 'ko-search-page',
      });
      expect(endTimer).toHaveBeenCalledWith('success');
    });

    it('passes the caller AbortSignal to the paged request', async () => {
      const httpService = {
        get: jest
          .fn()
          .mockReturnValue(
            of({ data: { result: [], nextPage: 2, isLastPage: false } }),
          ),
      };
      const client = new ClipClient(
        httpService as any,
        buildMetricsService() as any,
        AI_CONFIG,
      );
      const controller = new AbortController();

      await client.koSearchPage('keyword', 20, 1, controller.signal);

      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.kezzlecake.com/clip/cakes/ko-search-page?keyword=keyword&size=20&page=1',
        { signal: controller.signal },
      );
    });
  });
});
