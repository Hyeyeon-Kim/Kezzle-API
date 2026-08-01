import fixtures from '../../test/fixtures/legacy-persistence.contract.json';
import { model } from 'mongoose';
import { CurationPersistenceMapper } from './curation.persistence-mapper';
import { CurationPresenter } from './curation.presenter';
import { Curation, CurationSchema } from './entities/curation.schema';

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

  it('removes Mongoose subdocument internals before presenting a hydrated document', () => {
    const curationModel = model<Curation>(
      'HydratedCurationMapperContract',
      CurationSchema,
    );
    const hydrated = curationModel.hydrate(fixtures.curation);

    const response = CurationPresenter.created(
      CurationPersistenceMapper.toView(hydrated),
    );
    const serialized = JSON.parse(JSON.stringify(response));

    expect({
      ...serialized,
      refreshClaimedAt: fixtures.curation.refreshClaimedAt,
    }).toEqual(fixtures.curation);
    expect(serialized).not.toHaveProperty('refreshClaimedAt');
    expect(serialized.cakes[0]).not.toHaveProperty('_doc');
    expect(serialized.cakes[0]).not.toHaveProperty('$__');
    expect(serialized.cakes[0]).toHaveProperty('legacy_extra', 'must-stay');
  });
});
