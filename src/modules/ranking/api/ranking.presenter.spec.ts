import fixtures from '../../../../test/fixtures/type-boundary-read.contract.json';
import { ImageExternalMapper } from 'src/shared/image/application/image-external.mapper';
import { RankingPresenter } from './ranking.presenter';

describe('RankingPresenter', () => {
  it('keeps the keyword rank API fixture', () => {
    expect(
      RankingPresenter.keyword({
        ranking: fixtures.searchRank.ranking.map((item) => ({
          id: item._id,
          count: item.count,
        })),
        startDate: fixtures.searchRank.startDate,
        endDate: fixtures.searchRank.endDate,
      }),
    ).toEqual(fixtures.searchRank);
  });

  it('keeps the popular Cake API fixture', () => {
    expect(
      RankingPresenter.popular({
        cakes: fixtures.popularCakes.cakes.map((cake) => ({
          id: cake._id,
          image: ImageExternalMapper.toValue(cake.image),
          ownerStoreId: cake.owner_store_id,
          likedUserIds: [],
          tags: cake.hashtag,
          calculatedLikes: cake.popular_cal,
          isDeleted: false,
        })),
        startDate: fixtures.popularCakes.startDate,
        endDate: fixtures.popularCakes.endDate,
      }),
    ).toEqual(fixtures.popularCakes);
  });
});
