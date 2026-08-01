import fixtures from '../test/fixtures/type-boundary-read.contract.json';
import { CakePresenter } from './cake/cake.presenter';
import { ImageMapper } from './common/image/image.mapper';
import { CurationPresenter } from './curation/curation.presenter';
import { SearchPresenter } from './search/search.presenter';
import { StorePresenter } from './store/store.presenter';
import { Roles } from './user/entities/roles.enum';
import { UserPresenter } from './user/user.presenter';

const toCakeView = (cake: any, liked = false) => ({
  id: cake._id,
  image: ImageMapper.toValue(cake.image),
  ownerStoreId: cake.owner_store_id,
  likedUserIds: liked ? ['user-1'] : [],
  cursor: cake.cursor,
  tags: [...(cake.hashtag ?? [])],
  calculatedLikes: cake.popular_cal,
  isDeleted: false,
});

describe('Type-D API presenters', () => {
  it('keeps Cake detail, page, and popular response fixtures', () => {
    expect(
      CakePresenter.detail(toCakeView(fixtures.cakeDetail, true), 'user-1'),
    ).toEqual(fixtures.cakeDetail);
    expect(
      CakePresenter.simpleList({
        hasMore: fixtures.newestCakes.hasMore,
        cakes: fixtures.newestCakes.cakes.map((cake) => toCakeView(cake)),
      }),
    ).toEqual(fixtures.newestCakes);
    expect(
      CakePresenter.popular({
        startDate: fixtures.popularCakes.startDate,
        endDate: fixtures.popularCakes.endDate,
        cakes: fixtures.popularCakes.cakes.map((cake) => toCakeView(cake)),
      }),
    ).toEqual(fixtures.popularCakes);
  });

  it('keeps Store and User response fixtures', () => {
    const store = fixtures.storeDetail;
    expect(
      StorePresenter.detail(
        {
          id: store._id,
          name: store.name,
          logo: store.logo,
          feature: store.store_feature,
          description: store.store_description,
          instagramUrl: store.insta_url,
          kakaoChannelUrl: store.kakako_url,
          kakaoMapUrl: store.kakao_map_url,
          location: {
            latitude: store.latitude,
            longitude: store.longitude,
          },
          address: store.address,
          phoneNumber: store.phone_number,
          ownerUserId: 'seller-1',
          detailImages: [],
          operatingTime: store.operating_time,
          likedUserIds: [],
          taste: store.taste,
          distance: null,
        },
        'user-1',
      ),
    ).toEqual(store);

    const user = fixtures.userDetail;
    expect(
      UserPresenter.detail({
        firebaseUid: user.firebaseUid,
        nickname: user.nickname,
        oauthProvider: 'password',
        roles: user.roles as Roles[],
        cakeLikeIds: user.cake_like_ids,
        storeLikeIds: [],
      }),
    ).toEqual(user);
  });

  it('keeps Search and Curation feature-owned nested responses', () => {
    const search = fixtures.searchResult;
    expect(
      SearchPresenter.result(
        {
          hasMore: search.hasMore,
          nextPage: search.nextPage,
          cakes: search.cakes.map((cake) => toCakeView(cake)),
        },
        'user-1',
      ),
    ).toEqual(search);

    const curation = fixtures.curationDetail;
    expect(
      CurationPresenter.detail({
        description: curation.description,
        cakes: curation.cakes.map((cake) => toCakeView(cake)),
      }),
    ).toEqual(curation);
  });
});
