import { Model, model } from 'mongoose';
import { Cake, CakeSchema } from 'src/cake/entities/cake.schema';
import {
  Curation,
  CurationSchema,
} from 'src/curation/entities/curation.schema';
import { Store, StoreSchema } from 'src/store/entities/store.schema';
import { User, UserSchema } from 'src/user/entities/user.schema';
import baseline from './fixtures/log-upload-baseline.contract.json';
import fixtures from './fixtures/legacy-persistence.contract.json';

function hydrateToJson<T>(mongooseModel: Model<T>, fixture: unknown) {
  const document = mongooseModel.hydrate(fixture);
  return JSON.parse(JSON.stringify(document.toObject()));
}

describe('Type-A legacy persistence contract baseline', () => {
  const cakeModel = model<Cake>('TypeABaselineCake', CakeSchema);
  const storeModel = model<Store>('TypeABaselineStore', StoreSchema);
  const userModel = model<User>('TypeABaselineUser', UserSchema);
  const curationModel = model<Curation>(
    'TypeABaselineCuration',
    CurationSchema,
  );

  it('keeps a legacy Cake document and all nested Image keys', () => {
    const roundTripped = hydrateToJson(cakeModel, fixtures.cake);

    expect(roundTripped).toEqual(fixtures.cake);
    expect(roundTripped.image).not.toHaveProperty('_id');
    expect(Object.keys(roundTripped.image).sort()).toEqual(
      [...baseline.imageJsonKeys].sort(),
    );
    expect(roundTripped.image).toEqual(
      expect.objectContaining({
        converte_name: 'legacy-cake-converted.png',
        key: 'legacy/cakes/legacy-cake-converted.png',
      }),
    );
  });

  it('keeps a legacy Store document with optional and array Images', () => {
    const roundTripped = hydrateToJson(storeModel, fixtures.store);

    expect(roundTripped).toEqual(fixtures.store);
    expect(roundTripped.logo).not.toHaveProperty('_id');
    expect(Object.keys(roundTripped.logo).sort()).toEqual(
      [...baseline.imageJsonKeys].sort(),
    );
    expect(roundTripped.detail_images).toHaveLength(1);
    expect(roundTripped.detail_images[0]).not.toHaveProperty('_id');
    expect(Object.keys(roundTripped.detail_images[0]).sort()).toEqual(
      [...baseline.imageJsonKeys].sort(),
    );
    expect(roundTripped.detail_images[0]).toHaveProperty('converte_name');
  });

  it('keeps Store null logo and empty detail image array unchanged', () => {
    const roundTripped = hydrateToJson(storeModel, {
      _id: '65a000000000000000000099',
      name: 'No Image Store',
      logo: null,
      address: '서울시 강남구',
      owner_user_id: 'seller-1',
      detail_images: [],
      taste: [],
    });

    expect(roundTripped.logo).toBeNull();
    expect(roundTripped.detail_images).toEqual([]);
  });

  it('keeps User roles and like identifiers as arrays', () => {
    const roundTripped = hydrateToJson(userModel, fixtures.user);

    expect(roundTripped).toEqual(fixtures.user);
    expect(roundTripped.roles).toEqual(['isSeller', 'isBuyer']);
    expect(roundTripped.cake_like_ids).toEqual(['cake-1']);
    expect(roundTripped.store_like_ids).toEqual([]);
  });

  it('keeps every known and extra Curation cake snapshot key', () => {
    const roundTripped = hydrateToJson(curationModel, fixtures.curation);

    expect(roundTripped).toEqual(fixtures.curation);
    expect(Object.keys(roundTripped.cakes[0]).sort()).toEqual(
      [
        'cursor',
        'id',
        'image',
        'legacy_extra',
        'owner_store_id',
        'score',
        'tag_ins',
        'user_like_ids',
      ].sort(),
    );
    expect(roundTripped.cakes[0].legacy_extra).toBe('must-stay');
  });
});
