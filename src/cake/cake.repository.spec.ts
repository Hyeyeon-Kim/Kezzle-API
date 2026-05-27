import { CakeRepository } from './cake.repository';

describe('CakeRepository', () => {
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
