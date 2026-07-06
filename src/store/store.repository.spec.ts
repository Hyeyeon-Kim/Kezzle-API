import { StoreRepository } from './store.repository';
import { StoreNotFoundException } from './exceptions/store-not-found.exception';

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

  describe('findByIdOrThrow', () => {
    it('returns the document when found', async () => {
      const doc = { _id: 'store-1', name: 'Mock' };
      const storeModel = { findById: jest.fn().mockResolvedValue(doc) };
      const repo = new StoreRepository(storeModel as any);

      const result = await repo.findByIdOrThrow('store-1');

      expect(result).toBe(doc);
    });

    it('throws StoreNotFoundException when document is null', async () => {
      const storeModel = { findById: jest.fn().mockResolvedValue(null) };
      const repo = new StoreRepository(storeModel as any);

      await expect(repo.findByIdOrThrow('missing')).rejects.toBeInstanceOf(
        StoreNotFoundException,
      );
    });

    it('throws StoreNotFoundException when the query errors', async () => {
      const storeModel = {
        findById: jest.fn().mockRejectedValue(new Error('CastError')),
      };
      const repo = new StoreRepository(storeModel as any);

      await expect(repo.findByIdOrThrow('bad-id')).rejects.toBeInstanceOf(
        StoreNotFoundException,
      );
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

  describe('create', () => {
    it('delegates to storeModel.create', async () => {
      const created = { _id: 'new-store' };
      const storeModel = { create: jest.fn().mockResolvedValue(created) };
      const repo = new StoreRepository(storeModel as any);

      const doc = { name: 'New Store' };
      const result = await repo.create(doc);

      expect(storeModel.create).toHaveBeenCalledWith(doc);
      expect(result).toBe(created);
    });
  });

  describe('updateOneById', () => {
    it('wraps set fields in $set and filters by _id', async () => {
      const updateResult = { modifiedCount: 1 };
      const storeModel = {
        updateOne: jest.fn().mockResolvedValue(updateResult),
      };
      const repo = new StoreRepository(storeModel as any);

      const result = await repo.updateOneById('store-1', { name: 'Renamed' });

      expect(storeModel.updateOne).toHaveBeenCalledWith(
        { _id: 'store-1' },
        { $set: { name: 'Renamed' } },
      );
      expect(result).toBe(updateResult);
    });
  });

  describe('deleteById', () => {
    it('deletes by _id filter', async () => {
      const deleteResult = { deletedCount: 1 };
      const storeModel = {
        deleteOne: jest.fn().mockResolvedValue(deleteResult),
      };
      const repo = new StoreRepository(storeModel as any);

      const result = await repo.deleteById('store-1');

      expect(storeModel.deleteOne).toHaveBeenCalledWith({ _id: 'store-1' });
      expect(result).toBe(deleteResult);
    });
  });

  describe('findByUserLike', () => {
    it('queries stores where user_like_ids contains userId', async () => {
      const expected = [{ _id: 'store-1' }];
      const storeModel = { find: jest.fn().mockResolvedValue(expected) };
      const repo = new StoreRepository(storeModel as any);

      const result = await repo.findByUserLike('user-1');

      expect(storeModel.find).toHaveBeenCalledWith({
        user_like_ids: { $in: ['user-1'] },
      });
      expect(result).toBe(expected);
    });
  });

  describe('addUserLike', () => {
    it('adds userId to user_like_ids via $addToSet', async () => {
      const storeModel = { updateOne: jest.fn().mockResolvedValue({}) };
      const repo = new StoreRepository(storeModel as any);

      await repo.addUserLike('store-1', 'user-1');

      expect(storeModel.updateOne).toHaveBeenCalledWith(
        { _id: 'store-1' },
        { $addToSet: { user_like_ids: ['user-1'] } },
      );
    });
  });

  describe('removeUserLike', () => {
    it('removes userId from user_like_ids via $pull', async () => {
      const storeModel = { updateOne: jest.fn().mockResolvedValue({}) };
      const repo = new StoreRepository(storeModel as any);

      await repo.removeUserLike('store-1', 'user-1');

      expect(storeModel.updateOne).toHaveBeenCalledWith(
        { _id: 'store-1' },
        { $pull: { user_like_ids: 'user-1' } },
      );
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

  describe('findByGeoNear', () => {
    it('builds geoNear + dist match pipeline and limits when after is a number', async () => {
      const limit = jest.fn().mockResolvedValue([{ _id: 's1', dist: 10 }]);
      const storeModel = { aggregate: jest.fn().mockReturnValue({ limit }) };
      const repo = new StoreRepository(storeModel as any);

      const result = await repo.findByGeoNear(127.01, 37.01, 3000, 5, 11);

      expect(storeModel.aggregate).toHaveBeenCalledWith([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [127.01, 37.01] },
            distanceField: 'dist',
            spherical: true,
            maxDistance: 3000,
          },
        },
        { $match: { dist: { $gt: 5 } } },
      ]);
      expect(limit).toHaveBeenCalledWith(11);
      expect(result).toEqual([{ _id: 's1', dist: 10 }]);
    });

    it('drops the dist match stage when after is NaN', async () => {
      const limit = jest.fn().mockResolvedValue([]);
      const storeModel = { aggregate: jest.fn().mockReturnValue({ limit }) };
      const repo = new StoreRepository(storeModel as any);

      await repo.findByGeoNear(127.01, 37.01, NaN, NaN, 11);

      const pipeline = storeModel.aggregate.mock.calls[0][0];
      expect(pipeline).toHaveLength(1);
      expect(pipeline[0].$geoNear.maxDistance).toBeUndefined();
    });
  });
});
