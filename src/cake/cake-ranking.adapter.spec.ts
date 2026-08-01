import { CakeRankingRepositoryAdapter } from './cake-ranking.adapter';

describe('CakeRankingRepositoryAdapter', () => {
  it('maps one batch repository call to ranking views', async () => {
    const cakeRepository = {
      findRankingByIds: jest.fn().mockResolvedValue([
        {
          id: 'cake-1',
          image: { s3Url: 'cake.jpg' },
          ownerStoreId: 'store-1',
          likeText: '10',
          tags: ['birthday'],
        },
      ]),
    };
    const adapter = new CakeRankingRepositoryAdapter(cakeRepository as never);

    const result = await adapter.findByIds(['cake-1', 'cake-2']);

    expect(cakeRepository.findRankingByIds).toHaveBeenCalledTimes(1);
    expect(cakeRepository.findRankingByIds).toHaveBeenCalledWith([
      'cake-1',
      'cake-2',
    ]);
    expect(result).toEqual([
      {
        id: 'cake-1',
        image: { s3Url: 'cake.jpg' },
        ownerStoreId: 'store-1',
        likeText: '10',
        tags: ['birthday'],
      },
    ]);
  });
});
