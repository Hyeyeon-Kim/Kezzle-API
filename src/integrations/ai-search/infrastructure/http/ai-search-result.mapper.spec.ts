import { AiSearchResultMapper } from './ai-search-result.mapper';

describe('AiSearchResultMapper', () => {
  it('normalizes legacy AI response fields at the HTTP boundary', () => {
    expect(
      AiSearchResultMapper.toApplication({
        _id: 'cake-1',
        image: {
          name: 'cake.jpg',
          converte_name: 'cake.webp',
          key: 'cakes/cake.webp',
          s3Url: 'https://cdn/cake.webp',
        },
        user_like_ids: ['user-1'],
        owner_store_id: 'store-1',
        like_ins: '12',
        tag_ins: ['birthday'],
        content_ins: 'custom cake',
        cal_likes: 14,
        faiss_id: 7,
        is_delete: false,
        score: 0.9,
        modelVersion: 'v2',
      }),
    ).toEqual({
      id: 'cake-1',
      image: {
        name: 'cake.jpg',
        converteName: 'cake.webp',
        key: 'cakes/cake.webp',
        s3Url: 'https://cdn/cake.webp',
      },
      cursor: undefined,
      likedUserIds: ['user-1'],
      ownerStoreId: 'store-1',
      likeText: '12',
      tags: ['birthday'],
      content: 'custom cake',
      calculatedLikes: 14,
      faissId: 7,
      isDeleted: false,
      score: 0.9,
      createdAt: undefined,
      updatedAt: undefined,
      extra: { modelVersion: 'v2' },
    });
  });
});
