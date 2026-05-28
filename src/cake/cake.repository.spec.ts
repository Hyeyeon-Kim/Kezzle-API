import { CakeRepository } from './cake.repository';
import { CakeNotFoundException } from './exceptions/cake-not-found.exception';

describe('CakeRepository', () => {
  describe('findByIdOrThrow', () => {
    it('returns the document when found', async () => {
      const doc = { _id: 'cake-1', owner_store_id: 'store-1' };
      const cakeModel = { findById: jest.fn().mockResolvedValue(doc) };
      const repo = new CakeRepository(cakeModel as any);

      const result = await repo.findByIdOrThrow('cake-1');

      expect(cakeModel.findById).toHaveBeenCalledWith('cake-1');
      expect(result).toBe(doc);
    });

    it('throws CakeNotFoundException when document is null', async () => {
      const cakeModel = { findById: jest.fn().mockResolvedValue(null) };
      const repo = new CakeRepository(cakeModel as any);

      await expect(repo.findByIdOrThrow('missing')).rejects.toBeInstanceOf(
        CakeNotFoundException,
      );
    });

    it('throws CakeNotFoundException when the query errors (bad id)', async () => {
      const cakeModel = {
        findById: jest.fn().mockRejectedValue(new Error('CastError')),
      };
      const repo = new CakeRepository(cakeModel as any);

      await expect(repo.findByIdOrThrow('bad-id')).rejects.toBeInstanceOf(
        CakeNotFoundException,
      );
    });
  });

  describe('create', () => {
    it('delegates to cakeModel.create', async () => {
      const created = { _id: 'new-cake' };
      const cakeModel = { create: jest.fn().mockResolvedValue(created) };
      const repo = new CakeRepository(cakeModel as any);

      const doc = { owner_store_id: 'store-1', cursor: 'c1' };
      const result = await repo.create(doc as any);

      expect(cakeModel.create).toHaveBeenCalledWith(doc);
      expect(result).toBe(created);
    });
  });

  describe('updateOneById', () => {
    it('wraps set fields in $set and filters by _id', async () => {
      const updateResult = { modifiedCount: 1 };
      const cakeModel = {
        updateOne: jest.fn().mockResolvedValue(updateResult),
      };
      const repo = new CakeRepository(cakeModel as any);

      const result = await repo.updateOneById('cake-1', { is_delete: true });

      expect(cakeModel.updateOne).toHaveBeenCalledWith(
        { _id: 'cake-1' },
        { $set: { is_delete: true } },
      );
      expect(result).toBe(updateResult);
    });
  });

  describe('findByIds', () => {
    it('queries with $in filter', async () => {
      const expected = [{ _id: 'a' }, { _id: 'b' }];
      const cakeModel = { find: jest.fn().mockResolvedValue(expected) };
      const repo = new CakeRepository(cakeModel as any);

      const result = await repo.findByIds(['a', 'b']);

      expect(cakeModel.find).toHaveBeenCalledWith({ _id: { $in: ['a', 'b'] } });
      expect(result).toBe(expected);
    });
  });

  describe('addUserLike', () => {
    it('adds userId to user_like_ids via $addToSet', async () => {
      const cakeModel = { updateOne: jest.fn().mockResolvedValue({}) };
      const repo = new CakeRepository(cakeModel as any);

      await repo.addUserLike('cake-1', 'user-1');

      expect(cakeModel.updateOne).toHaveBeenCalledWith(
        { _id: 'cake-1' },
        { $addToSet: { user_like_ids: ['user-1'] } },
      );
    });
  });

  describe('removeUserLike', () => {
    it('removes userId from user_like_ids via $pull', async () => {
      const cakeModel = { updateOne: jest.fn().mockResolvedValue({}) };
      const repo = new CakeRepository(cakeModel as any);

      await repo.removeUserLike('cake-1', 'user-1');

      expect(cakeModel.updateOne).toHaveBeenCalledWith(
        { _id: 'cake-1' },
        { $pull: { user_like_ids: 'user-1' } },
      );
    });
  });

  describe('findRecentByStoreIds', () => {
    it('returns empty Map without querying when storeIds is empty', async () => {
      const cakeModel = { aggregate: jest.fn() };
      const repo = new CakeRepository(cakeModel as any);

      const result = await repo.findRecentByStoreIds([]);

      expect(result.size).toBe(0);
      expect(cakeModel.aggregate).not.toHaveBeenCalled();
    });

    it('builds a single aggregate with $match/$sort/$group/$slice and returns a Map keyed by storeId', async () => {
      const cakeModel = {
        aggregate: jest.fn().mockResolvedValue([
          {
            _id: 'store-1',
            cakes: [
              { _id: 'cake-a', owner_store_id: 'store-1' },
              { _id: 'cake-b', owner_store_id: 'store-1' },
            ],
          },
          {
            _id: 'store-2',
            cakes: [{ _id: 'cake-c', owner_store_id: 'store-2' }],
          },
        ]),
      };
      const repo = new CakeRepository(cakeModel as any);

      const result = await repo.findRecentByStoreIds(
        ['store-1', 'store-2', 'store-3'],
        20,
      );

      expect(cakeModel.aggregate).toHaveBeenCalledTimes(1);
      expect(cakeModel.aggregate).toHaveBeenCalledWith([
        {
          $match: {
            is_delete: false,
            owner_store_id: { $in: ['store-1', 'store-2', 'store-3'] },
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$owner_store_id',
            cakes: { $push: '$$ROOT' },
          },
        },
        {
          $project: {
            _id: 1,
            cakes: { $slice: ['$cakes', 20] },
          },
        },
      ]);

      expect(result.size).toBe(2);
      expect(result.get('store-1')).toHaveLength(2);
      expect(result.get('store-1')?.[0]).toMatchObject({ _id: 'cake-a' });
      expect(result.get('store-2')).toHaveLength(1);
      expect(result.get('store-3')).toBeUndefined();
    });

    it('defaults perStoreLimit to 20 when not provided', async () => {
      const cakeModel = { aggregate: jest.fn().mockResolvedValue([]) };
      const repo = new CakeRepository(cakeModel as any);

      await repo.findRecentByStoreIds(['store-1']);

      const pipeline = cakeModel.aggregate.mock.calls[0][0];
      expect(pipeline[3].$project.cakes.$slice).toEqual(['$cakes', 20]);
    });

    it('passes custom perStoreLimit through to the $slice stage', async () => {
      const cakeModel = { aggregate: jest.fn().mockResolvedValue([]) };
      const repo = new CakeRepository(cakeModel as any);

      await repo.findRecentByStoreIds(['store-1'], 5);

      const pipeline = cakeModel.aggregate.mock.calls[0][0];
      expect(pipeline[3].$project.cakes.$slice).toEqual(['$cakes', 5]);
    });
  });
});
