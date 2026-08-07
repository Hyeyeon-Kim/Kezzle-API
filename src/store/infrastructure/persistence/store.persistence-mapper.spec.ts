import fixtures from '../../../../test/fixtures/legacy-persistence.contract.json';
import { StorePersistenceMapper } from './store.persistence-mapper';

describe('StorePersistenceMapper', () => {
  it('maps a legacy persistence record to a pure Store view', () => {
    expect(StorePersistenceMapper.toView(fixtures.store)).toMatchObject({
      id: '65a000000000000000000002',
      name: 'Legacy Store',
      logo: { converteName: 'logo-converted.png' },
      feature: 'legacy feature',
      description: 'legacy description',
      instagramUrl: 'https://instagram.com/legacy',
      kakaoChannelUrl: 'https://pf.kakao.com/legacy',
      kakaoMapUrl: 'https://map.kakao.com/legacy',
      location: { longitude: 127.1, latitude: 37.5 },
      phoneNumber: '02-0000-0000',
      ownerUserId: 'seller-1',
      detailImages: [{ converteName: 'detail-converted.png' }],
      operatingTime: ['10:00-18:00'],
      likedUserIds: [],
      taste: ['바닐라'],
    });
  });

  it('maps summary and write data at the persistence boundary', () => {
    expect(StorePersistenceMapper.toSummaryView(fixtures.store)).toEqual({
      id: '65a000000000000000000002',
      name: 'Legacy Store',
      address: '서울시 강남구',
      taste: ['바닐라'],
      longitude: 127.1,
      latitude: 37.5,
    });

    expect(
      StorePersistenceMapper.toCreatePersistence({
        name: 'New Store',
        location: { longitude: 127.2, latitude: 37.6 },
        address: 'Seoul',
        ownerUserId: 'seller-1',
        operatingTime: ['09:00-18:00'],
        taste: ['chocolate'],
      }),
    ).toMatchObject({
      name: 'New Store',
      location: { type: 'Point', coordinates: [127.2, 37.6] },
      address: 'Seoul',
      owner_user_id: 'seller-1',
      operating_time: ['09:00-18:00'],
      taste: ['chocolate'],
    });

    expect(
      StorePersistenceMapper.toUpdatePersistence({
        feature: 'updated',
        phoneNumber: '02-1111-1111',
        location: { longitude: 128, latitude: 38 },
      }),
    ).toEqual({
      store_feature: 'updated',
      phone_number: '02-1111-1111',
      location: { type: 'Point', coordinates: [128, 38] },
    });
  });

  it('owns image persistence keys and keeps null and empty-array policy', () => {
    const image = {
      name: 'store.png',
      converteName: 'store-converted.png',
      key: 'stores/store-converted.png',
      s3Url: 'https://cdn.example.com/stores/store-converted.png',
    };

    expect(
      StorePersistenceMapper.toCreatePersistence({
        name: 'Image Store',
        logo: image,
        location: { longitude: 127.2, latitude: 37.6 },
        address: 'Seoul',
        ownerUserId: 'seller-1',
        detailImages: [image],
        operatingTime: [],
        taste: [],
      }),
    ).toMatchObject({
      logo: {
        name: 'store.png',
        converte_name: 'store-converted.png',
        key: 'stores/store-converted.png',
        s3Url: 'https://cdn.example.com/stores/store-converted.png',
      },
      detail_images: [
        {
          name: 'store.png',
          converte_name: 'store-converted.png',
          key: 'stores/store-converted.png',
          s3Url: 'https://cdn.example.com/stores/store-converted.png',
        },
      ],
    });
    expect(
      StorePersistenceMapper.toView({
        id: 'store-empty-images',
        logo: null,
        detail_images: [],
      }),
    ).toMatchObject({
      logo: null,
      detailImages: [],
    });
  });
});
