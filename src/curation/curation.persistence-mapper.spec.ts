import fixtures from '../../test/fixtures/legacy-persistence.contract.json';
import { CurationPersistenceMapper } from './curation.persistence-mapper';

describe('CurationPersistenceMapper', () => {
  it('maps legacy snapshots to pure views and preserves additional keys', () => {
    const view = CurationPersistenceMapper.toView(fixtures.curation);

    expect(view).toMatchObject({
      id: '65a000000000000000000004',
      key: '레거시 큐레이션',
      cakes: [
        {
          id: 'legacy-cake-snapshot-1',
          ownerStoreId: 'store-1',
          tags: ['레거시'],
          likedUserIds: ['legacy-user-1'],
          score: 0.125,
          extra: { legacy_extra: 'must-stay' },
        },
      ],
    });

    expect(
      CurationPersistenceMapper.toCakePersistence(view.cakes[0]),
    ).toMatchObject({
      id: 'legacy-cake-snapshot-1',
      owner_store_id: 'store-1',
      tag_ins: ['레거시'],
      user_like_ids: ['legacy-user-1'],
      legacy_extra: 'must-stay',
    });
  });
});
