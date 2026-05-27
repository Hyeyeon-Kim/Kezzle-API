import { StoreRepository } from './store.repository';

describe('StoreRepository', () => {
  describe('findById', () => {
    it('delegates to storeModel.findById', async () => {
      const expected = { _id: 'mock-store-1', name: 'Mock' };
      const storeModel = {
        findById: jest.fn().mockResolvedValue(expected),
      };
      const repo = new StoreRepository(storeModel as any);

      const result = await repo.findById('mock-store-1');

      expect(storeModel.findById).toHaveBeenCalledWith('mock-store-1');
      expect(result).toBe(expected);
    });
  });

  describe('findByIdsWithProjection', () => {
    it('queries with $in filter and projection, returning lean result', async () => {
      const expected = [{ _id: 'a' }, { _id: 'b' }];
      const lean = jest.fn().mockResolvedValue(expected);
      const storeModel = {
        find: jest.fn().mockReturnValue({ lean }),
      };
      const repo = new StoreRepository(storeModel as any);

      const projection = { name: 1, address: 1 } as const;
      const result = await repo.findByIdsWithProjection(
        ['a', 'b'],
        projection as any,
      );

      expect(storeModel.find).toHaveBeenCalledWith(
        { _id: { $in: ['a', 'b'] } },
        projection,
      );
      expect(lean).toHaveBeenCalledTimes(1);
      expect(result).toBe(expected);
    });
  });

  describe('findIdsByGeoNear', () => {
    it('builds geoNear pipeline with maxDistance and returns id strings', async () => {
      const storeModel = {
        aggregate: jest
          .fn()
          .mockResolvedValue([
            { _id: { toString: () => 'store-1' } },
            { _id: { toString: () => 'store-2' } },
          ]),
      };
      const repo = new StoreRepository(storeModel as any);

      const result = await repo.findIdsByGeoNear(127.01, 37.01, 3000);

      expect(storeModel.aggregate).toHaveBeenCalledWith([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [127.01, 37.01] },
            distanceField: 'dist',
            spherical: true,
            maxDistance: 3000,
          },
        },
        { $project: { _id: 1 } },
      ]);
      expect(result).toEqual(['store-1', 'store-2']);
    });

    it('omits maxDistance when distance is undefined', async () => {
      const storeModel = {
        aggregate: jest.fn().mockResolvedValue([]),
      };
      const repo = new StoreRepository(storeModel as any);

      await repo.findIdsByGeoNear(127.01, 37.01);

      const pipeline = storeModel.aggregate.mock.calls[0][0];
      expect(pipeline[0].$geoNear.maxDistance).toBeUndefined();
    });

    it('omits maxDistance when distance is NaN', async () => {
      const storeModel = {
        aggregate: jest.fn().mockResolvedValue([]),
      };
      const repo = new StoreRepository(storeModel as any);

      await repo.findIdsByGeoNear(127.01, 37.01, NaN);

      const pipeline = storeModel.aggregate.mock.calls[0][0];
      expect(pipeline[0].$geoNear.maxDistance).toBeUndefined();
    });
  });
});
