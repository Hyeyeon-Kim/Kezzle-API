import fixtures from '../../../test/fixtures/legacy-persistence.contract.json';
import { CakePersistenceMapper } from './cake.persistence-mapper';

describe('CakePersistenceMapper', () => {
  it('maps a legacy persistence record to a pure Cake view', () => {
    expect(CakePersistenceMapper.toView(fixtures.cake)).toMatchObject({
      id: '65a000000000000000000001',
      image: {
        name: 'legacy-cake.png',
        converteName: 'legacy-cake-converted.png',
        key: 'legacy/cakes/legacy-cake-converted.png',
      },
      ownerStoreId: 'store-1',
      likedUserIds: ['user-1'],
      likeText: '12',
      tags: ['레거시', '초코'],
      content: 'legacy cake content',
      calculatedLikes: 12,
      faissId: 101,
      isDeleted: false,
    });
  });

  it('maps pure create and update data to legacy persistence keys', () => {
    const image = {
      name: 'cake.png',
      converteName: 'cake-converted.png',
      key: 'cakes/cake-converted.png',
      s3Url: 'https://cdn.example.com/cake-converted.png',
    };

    expect(
      CakePersistenceMapper.toCreatePersistence({
        image,
        ownerStoreId: 'store-1',
        cursor: 'cursor-1',
        likeText: '5',
        tags: ['vanilla'],
        content: 'cake',
        faissId: 10,
      }),
    ).toEqual({
      image: {
        name: 'cake.png',
        converte_name: 'cake-converted.png',
        key: 'cakes/cake-converted.png',
        s3Url: 'https://cdn.example.com/cake-converted.png',
      },
      owner_store_id: 'store-1',
      cursor: 'cursor-1',
      like_ins: '5',
      tag_ins: ['vanilla'],
      content_ins: 'cake',
      faiss_id: 10,
    });
    expect(
      CakePersistenceMapper.toUpdatePersistence({
        image,
        isDeleted: true,
      }),
    ).toMatchObject({
      image: { converte_name: 'cake-converted.png' },
      is_delete: true,
    });
  });
});
