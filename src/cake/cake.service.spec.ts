import { CakeService } from './cake.service';

describe('CakeService', () => {
  describe('similar', () => {
    it('delegates to SimilarCakeService.execute with the same arguments', async () => {
      const expected = { cakes: [], hasMore: false } as any;
      const similarCakeService = {
        execute: jest.fn().mockResolvedValue(expected),
      };

      const service = new CakeService(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        similarCakeService as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const result = await service.similar(
        'mock-cake-origin',
        127.01,
        37.01,
        3000,
        6,
      );

      expect(similarCakeService.execute).toHaveBeenCalledTimes(1);
      expect(similarCakeService.execute).toHaveBeenCalledWith(
        'mock-cake-origin',
        127.01,
        37.01,
        3000,
        6,
      );
      expect(result).toBe(expected);
    });
  });
});
