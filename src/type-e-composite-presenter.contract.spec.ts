import { CatalogPresenter } from './modules/catalog/api/catalog.presenter';
import { LikePresenter } from './modules/like/api/like.presenter';
import fixtures from '../test/fixtures/catalog-like-read.contract.json';

const json = (value: unknown) => JSON.parse(JSON.stringify(value));

const cakeView = (cake: any, likedUserId = 'viewer-user'): any => ({
  id: cake._id,
  image: cake.image,
  ownerStoreId: cake.owner_store_id,
  likedUserIds: cake.isLiked ? [likedUserId] : [],
  cursor: cake.cursor,
  tags: cake.hashtag,
});

describe('Type-E composite presenter HTTP contracts', () => {
  const catalogPresenter = new CatalogPresenter();
  const likePresenter = new LikePresenter();

  it.each([
    ['cakesByCursor', fixtures.cakesByCursor],
    ['cakesByLocation', fixtures.cakesByLocation],
    ['storeCakes', fixtures.storeCakes],
  ])('keeps the %s Cake page fixture', (_name, fixture) => {
    const response = catalogPresenter.cakePage(
      {
        cakes: fixture.cakes.map((cake) => cakeView(cake)),
        hasMore: fixture.hasMore,
      },
      'viewer-user',
    );

    expect(json(response)).toEqual(fixture);
  });

  it('keeps the Catalog store fixture', () => {
    const stores = fixtures.stores.stores.map((store) => ({
      id: store._id,
      name: store.name,
      logo: store.logo,
      address: store.address,
      likedUserIds: store.isLiked ? ['viewer-user'] : [],
      distance: store.distance,
    }));
    const cakesByStoreId = new Map(
      fixtures.stores.stores.map((store) => [
        store._id,
        store.cakes.map((cake) => cakeView(cake)),
      ]),
    );

    expect(
      json(
        catalogPresenter.storePage(
          { stores, cakesByStoreId, hasMore: fixtures.stores.hasMore } as any,
          'viewer-user',
        ),
      ),
    ).toEqual(fixtures.stores);
  });

  it('keeps the Catalog similar Cake fixture', () => {
    const page = {
      cakes: fixtures.similarCakes.cakes.map((cake) => ({
        id: cake._id,
        image: cake.image,
        ownerStoreId: cake.owner_store_id,
        ownerStoreName: cake.owner_store_name,
        ownerStoreAddress: cake.owner_store_address,
        ownerStoreTaste: cake.owner_store_taste,
        ownerStoreLatitude: cake.owner_store_latitude,
        ownerStoreLongitude: cake.owner_store_longitude,
      })),
      hasMore: fixtures.similarCakes.hasMore,
    };

    expect(json(catalogPresenter.similarCakes(page as any))).toEqual(
      fixtures.similarCakes,
    );
  });

  it('keeps the liked Cake fixture', () => {
    const cakes = fixtures.likedCakes.map((cake) => cakeView(cake));

    expect(json(likePresenter.cakes(cakes, 'viewer-user'))).toEqual(
      fixtures.likedCakes,
    );
  });

  it('keeps target-store and viewer-cake like semantics', () => {
    const stores = fixtures.likedStores.map((store) => ({
      id: store._id,
      name: store.name,
      logo: store.logo,
      address: store.address,
      likedUserIds: store.isLiked ? ['target-user'] : [],
      cakes: store.cakes.map((cake) => cakeView(cake, 'viewer-user')),
    }));

    expect(
      json(likePresenter.stores(stores as any, 'target-user', 'viewer-user')),
    ).toEqual(fixtures.likedStores);
  });
});
