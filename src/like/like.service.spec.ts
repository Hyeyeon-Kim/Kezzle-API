import { LikeService } from './like.service';

describe('LikeService', () => {
  describe('findUserLikeStore', () => {
    it('loads recent cakes by store ids through CakeRepository once', async () => {
      const userModel = {
        findOne: jest.fn().mockResolvedValue({
          firebaseUid: 'target-user',
          cake_like_ids: [],
        }),
      };
      const cakeRepository = {
        findRecentByStoreIds: jest.fn().mockResolvedValue(
          new Map([
            [
              'store-1',
              [
                {
                  _id: 'cake-1',
                  image: {},
                  owner_store_id: 'store-1',
                  user_like_ids: ['viewer-user'],
                  cursor: 'cursor-1',
                  tag_ins: [],
                },
              ],
            ],
          ]),
        ),
      };
      const storeRepository = {
        findByUserLike: jest.fn().mockResolvedValue([
          {
            _id: { toString: () => 'store-1' },
            name: 'store 1',
            logo: {},
            address: 'address 1',
            user_like_ids: ['target-user'],
          },
        ]),
      };
      const logService = {};
      const service = new LikeService(
        userModel as any,
        cakeRepository as any,
        storeRepository as any,
        logService as any,
      );

      const result = await service.findUserLikeStore('target-user', {
        firebaseUid: 'viewer-user',
      } as any);

      expect(storeRepository.findByUserLike).toHaveBeenCalledWith(
        'target-user',
      );
      expect(cakeRepository.findRecentByStoreIds).toHaveBeenCalledTimes(1);
      expect(cakeRepository.findRecentByStoreIds).toHaveBeenCalledWith([
        'store-1',
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].cakes).toHaveLength(1);
      expect(result[0].cakes[0].isLiked).toBe(true);
    });
  });
});
