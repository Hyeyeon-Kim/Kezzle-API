import { of } from 'rxjs';
import { VitClient } from './vit-client';

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
      const client = new VitClient(httpService as any);

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
      const client = new VitClient(httpService as any);

      await client.similarSearchWithLocation('id-1', 1, 2, 3, 4);

      expect(httpService.get).toHaveBeenCalledWith(
        'http://kezzle-ai-server:8001/cakes/similar-search?id=id-1&lon=1&lat=2&dist=3&size=4',
      );
    });
  });

  describe('similarSearch', () => {
    it('builds URL without location params and returns unwrapped result', async () => {
      const expected = [{ id: 'cake-1' }];
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: { result: expected } })),
      };
      const client = new VitClient(httpService as any);

      const result = await client.similarSearch('liked-cake-id', 6);

      expect(httpService.get).toHaveBeenCalledTimes(1);
      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.kezzlecake.com/vit/cakes/similar-search?id=liked-cake-id&size=6',
      );
      expect(result).toBe(expected);
    });
  });
});
