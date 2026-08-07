import { CakeAiSearchMapper } from './cake-ai-search.mapper';

describe('CakeAiSearchMapper image contract', () => {
  it('maps a legacy external image contract without using persistence types', () => {
    expect(
      CakeAiSearchMapper.toDomain({
        _id: 'cake-legacy',
        image: {
          name: 'legacy.png',
          converte_name: 'legacy-converted.png',
          key: 'cakes/legacy-converted.png',
          s3Url: 'https://cdn.example.com/cakes/legacy-converted.png',
        },
        owner_store_id: 'store-1',
        tag_ins: [],
      }),
    ).toMatchObject({
      id: 'cake-legacy',
      image: {
        name: 'legacy.png',
        converteName: 'legacy-converted.png',
        key: 'cakes/legacy-converted.png',
        s3Url: 'https://cdn.example.com/cakes/legacy-converted.png',
      },
      ownerStoreId: 'store-1',
      tags: [],
    });
  });

  it('keeps an application-style external image contract unchanged', () => {
    const image = {
      name: 'external.png',
      converteName: 'external-converted.png',
      key: 'cakes/external-converted.png',
      s3Url: 'https://cdn.example.com/cakes/external-converted.png',
    };

    expect(
      CakeAiSearchMapper.toDomain({ id: 'cake-external', image }).image,
    ).toEqual(image);
  });
});
