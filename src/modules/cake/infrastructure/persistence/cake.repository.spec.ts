import { CakeRepository } from './cake.repository';
import { CakeNotFoundException } from '../../application/exceptions/cake-not-found.exception';

describe('CakeRepository', () => {
  describe('findByIdOrThrow', () => {
    it('returns the document when found', async () => {
      const doc = { _id: 'cake-1', owner_store_id: 'store-1' };
      const cakeModel = { findById: jest.fn().mockResolvedValue(doc) };
      const repo = new CakeRepository(cakeModel as any);

      const result = await repo.findByIdOrThrow('cake-1');

      expect(cakeModel.findById).toHaveBeenCalledWith('cake-1');
      expect(result).toMatchObject({
        id: 'cake-1',
        ownerStoreId: 'store-1',
        likedUserIds: [],
        tags: [],
        isDeleted: false,
      });
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

  describe('findById', () => {
    it('filters deleted cakes and returns null when missing', async () => {
      const cakeModel = { findOne: jest.fn().mockResolvedValue(null) };
      const repo = new CakeRepository(cakeModel as any);

      const result = await repo.findById('cake-1');

      expect(cakeModel.findOne).toHaveBeenCalledWith({
        _id: 'cake-1',
        is_delete: false,
      });
      expect(result).toBeNull();
    });
  });

  describe('sampleOne', () => {
    it('returns first element of $sample aggregate', async () => {
      const sampled = { _id: 'random-cake' };
      const cakeModel = {
        aggregate: jest.fn().mockResolvedValue([sampled]),
      };
      const repo = new CakeRepository(cakeModel as any);

      const result = await repo.sampleOne();

      expect(cakeModel.aggregate).toHaveBeenCalledWith([
        { $match: { is_delete: false } },
        { $sample: { size: 1 } },
      ]);
      expect(result).toMatchObject({
        id: 'random-cake',
        likedUserIds: [],
        tags: [],
        isDeleted: false,
      });
    });

    it('returns null when no non-deleted cake can be sampled', async () => {
      const cakeModel = {
        aggregate: jest.fn().mockResolvedValue([]),
      };
      const repo = new CakeRepository(cakeModel as any);

      await expect(repo.sampleOne()).resolves.toBeNull();
    });
  });

  describe('findInStoresByCursor', () => {
    it('sorts by cursor asc and adds cursor filter when after present', async () => {
      const limit = jest.fn().mockResolvedValue([{ _id: 'c1' }]);
      const cakeModel = { aggregate: jest.fn().mockReturnValue({ limit }) };
      const repo = new CakeRepository(cakeModel as any);

      await repo.findInStoresByCursor(['s1', 's2'], 'cursor-10', 5);

      expect(cakeModel.aggregate).toHaveBeenCalledWith([
        { $sort: { cursor: 1 } },
        {
          $match: {
            is_delete: false,
            owner_store_id: { $in: ['s1', 's2'] },
            cursor: { $gt: 'cursor-10' },
          },
        },
      ]);
      expect(limit).toHaveBeenCalledWith(5);
    });

    it('omits cursor filter when after is empty', async () => {
      const limit = jest.fn().mockResolvedValue([]);
      const cakeModel = { aggregate: jest.fn().mockReturnValue({ limit }) };
      const repo = new CakeRepository(cakeModel as any);

      await repo.findInStoresByCursor(['s1'], '', 5);

      const pipeline = cakeModel.aggregate.mock.calls[0][0];
      expect(pipeline[1].$match.cursor).toBeUndefined();
    });
  });

  describe('findInStoresAfterId', () => {
    it('adds _id ObjectId filter when after present', async () => {
      const limit = jest.fn().mockResolvedValue([]);
      const cakeModel = { aggregate: jest.fn().mockReturnValue({ limit }) };
      const repo = new CakeRepository(cakeModel as any);

      await repo.findInStoresAfterId(['s1'], '507f1f77bcf86cd799439011', 5);

      const pipeline = cakeModel.aggregate.mock.calls[0][0];
      expect(pipeline[0].$match.owner_store_id).toEqual({ $in: ['s1'] });
      expect(pipeline[0].$match._id.$gt.toString()).toBe(
        '507f1f77bcf86cd799439011',
      );
      expect(limit).toHaveBeenCalledWith(5);
    });
  });

  describe('findNewest', () => {
    it('sorts by _id desc and adds _id ObjectId $lt filter when after present', async () => {
      const limit = jest.fn().mockResolvedValue([]);
      const cakeModel = { aggregate: jest.fn().mockReturnValue({ limit }) };
      const repo = new CakeRepository(cakeModel as any);

      await repo.findNewest('507f1f77bcf86cd799439011', 21);

      const pipeline = cakeModel.aggregate.mock.calls[0][0];
      expect(pipeline[0].$match.is_delete).toBe(false);
      expect(pipeline[0].$match._id.$lt.toString()).toBe(
        '507f1f77bcf86cd799439011',
      );
      expect(pipeline[1]).toEqual({ $sort: { _id: -1 } });
      expect(limit).toHaveBeenCalledWith(21);
    });

    it('keeps the non-deleted filter when after is undefined', async () => {
      const limit = jest.fn().mockResolvedValue([]);
      const cakeModel = { aggregate: jest.fn().mockReturnValue({ limit }) };
      const repo = new CakeRepository(cakeModel as any);

      await repo.findNewest(undefined as any, 21);

      const pipeline = cakeModel.aggregate.mock.calls[0][0];
      expect(pipeline).toEqual([
        { $match: { is_delete: false } },
        { $sort: { _id: -1 } },
      ]);
    });
  });

  describe('findByStoreIdAfter', () => {
    it('uses raw _id $gt filter when after present', async () => {
      const limit = jest.fn().mockResolvedValue([]);
      const cakeModel = { find: jest.fn().mockReturnValue({ limit }) };
      const repo = new CakeRepository(cakeModel as any);

      await repo.findByStoreIdAfter('s1', 'raw-id', 5);

      expect(cakeModel.find).toHaveBeenCalledWith({
        is_delete: false,
        owner_store_id: 's1',
        _id: { $gt: 'raw-id' },
      });
      expect(limit).toHaveBeenCalledWith(5);
    });

    it('omits _id filter when after is undefined', async () => {
      const limit = jest.fn().mockResolvedValue([]);
      const cakeModel = { find: jest.fn().mockReturnValue({ limit }) };
      const repo = new CakeRepository(cakeModel as any);

      await repo.findByStoreIdAfter('s1', undefined, 5);

      expect(cakeModel.find).toHaveBeenCalledWith({
        is_delete: false,
        owner_store_id: 's1',
      });
    });
  });

  describe('create', () => {
    it('delegates to cakeModel.create', async () => {
      const created = { _id: 'new-cake' };
      const cakeModel = { create: jest.fn().mockResolvedValue(created) };
      const repo = new CakeRepository(cakeModel as any);

      const data = {
        image: {
          name: 'cake.png',
          converteName: 'cake-converted.png',
          key: 'cakes/cake-converted.png',
          s3Url: 'https://cdn.example.com/cake-converted.png',
        },
        ownerStoreId: 'store-1',
        cursor: 'c1',
        tags: ['chocolate'],
        faissId: 1,
      };
      const result = await repo.create(data);

      expect(cakeModel.create).toHaveBeenCalledWith({
        image: {
          name: 'cake.png',
          converte_name: 'cake-converted.png',
          key: 'cakes/cake-converted.png',
          s3Url: 'https://cdn.example.com/cake-converted.png',
        },
        owner_store_id: 'store-1',
        cursor: 'c1',
        like_ins: undefined,
        tag_ins: ['chocolate'],
        content_ins: undefined,
        faiss_id: 1,
      });
      expect(result).toMatchObject({ id: 'new-cake' });
    });
  });

  describe('updateOneById', () => {
    it('wraps set fields in $set and filters by _id', async () => {
      const updateResult = { modifiedCount: 1 };
      const cakeModel = {
        updateOne: jest.fn().mockResolvedValue(updateResult),
      };
      const repo = new CakeRepository(cakeModel as any);

      const result = await repo.updateOneById('cake-1', { isDeleted: true });

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
      expect(result.map((cake) => cake.id)).toEqual(['a', 'b']);
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
      expect(result.get('store-1')?.[0]).toMatchObject({ id: 'cake-a' });
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
