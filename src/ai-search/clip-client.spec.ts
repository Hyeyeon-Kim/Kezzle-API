import { of } from 'rxjs';
import { ClipClient } from './clip-client';

describe('ClipClient', () => {
  const originalClipBaseUrl = process.env.CLIP_API_BASE_URL;

  beforeEach(() => {
    delete process.env.CLIP_API_BASE_URL;
  });

  afterAll(() => {
    if (originalClipBaseUrl === undefined) {
      delete process.env.CLIP_API_BASE_URL;
    } else {
      process.env.CLIP_API_BASE_URL = originalClipBaseUrl;
    }
  });

  describe('koSearch', () => {
    it('builds URL and returns unwrapped result', async () => {
      const expected = [{ id: 'cake-1' }];
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: expected } })),
      };
      const client = new ClipClient(httpService as any);

      const result = await client.koSearch('생일', 100);

      expect(httpService.get).toHaveBeenCalledTimes(1);
      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.kezzlecake.com/clip/cakes/ko-search?keyword=생일&size=100',
      );
      expect(result).toBe(expected);
    });

    it('uses CLIP_API_BASE_URL env override when set', async () => {
      process.env.CLIP_API_BASE_URL = 'http://kezzle-clip-server:8002';
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: [] } })),
      };
      const client = new ClipClient(httpService as any);

      await client.koSearch('test', 6);

      expect(httpService.get).toHaveBeenCalledWith(
        'http://kezzle-clip-server:8002/cakes/ko-search?keyword=test&size=6',
      );
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
      const client = new ClipClient(httpService as any);

      const response = await client.koSearchPage('딸기', 20, 1);

      expect(httpService.get).toHaveBeenCalledTimes(1);
      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.kezzlecake.com/clip/cakes/ko-search-page?keyword=딸기&size=20&page=1',
      );
      expect(response.result).toBe(result);
      expect(response.nextPage).toBe(2);
      expect(response.isLastPage).toBe(false);
    });
  });
});
