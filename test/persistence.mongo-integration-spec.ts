import { Connection, Model, createConnection } from 'mongoose';
import { ObjectId } from 'mongodb';
import { Cake, CakeSchema } from 'src/cake/entities/cake.schema';
import { CurationPersistenceMapper } from 'src/curation/curation.persistence-mapper';
import { CurationRepository } from 'src/curation/curation.repository';
import {
  Curation,
  CurationSchema,
} from 'src/curation/entities/curation.schema';
import { Store, StoreSchema } from 'src/store/entities/store.schema';
import { SearchEventRepository } from 'src/search/infrastructure/persistence/search-event.repository';
import {
  KeywordLog,
  KeywordLogSchema,
} from 'src/search/infrastructure/persistence/search-event.schema';
import { CakeLikeEventRepository } from 'src/like/infrastructure/persistence/cake-like-event.repository';
import {
  CakeLikeLog,
  CakeLikeLogSchema,
} from 'src/like/infrastructure/persistence/cake-like-event.schema';
import { User, UserSchema } from 'src/user/entities/user.schema';
import fixtures from './fixtures/legacy-persistence.contract.json';

function jsonValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe('Persistence Mongo integration contract', () => {
  let connection: Connection;
  let cakeModel: Model<Cake>;
  let storeModel: Model<Store>;
  let userModel: Model<User>;
  let curationModel: Model<Curation>;
  let keywordLogModel: Model<KeywordLog>;
  let cakeLikeLogModel: Model<CakeLikeLog>;

  beforeAll(async () => {
    if (!process.env.MONGODB_URL) {
      throw new Error('MONGODB_URL is required for Mongo integration tests');
    }

    connection = await createConnection(process.env.MONGODB_URL, {
      dbName:
        process.env.MONGODB_DBNAME_INTEGRATION ??
        `kezzle_type_boundary_${process.pid}`,
    }).asPromise();
    cakeModel = connection.model('ContractCake', CakeSchema, 'cakes');
    storeModel = connection.model('ContractStore', StoreSchema, 'stores');
    userModel = connection.model('ContractUser', UserSchema, 'users');
    curationModel = connection.model(
      'ContractCuration',
      CurationSchema,
      'curations',
    );
    keywordLogModel = connection.model('ContractKeywordLog', KeywordLogSchema);
    cakeLikeLogModel = connection.model(
      'ContractCakeLikeLog',
      CakeLikeLogSchema,
    );
  });

  beforeEach(async () => {
    await Promise.all([
      cakeModel.deleteMany({}),
      storeModel.deleteMany({}),
      userModel.deleteMany({}),
      curationModel.deleteMany({}),
      keywordLogModel.deleteMany({}),
      cakeLikeLogModel.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    if (connection) {
      await connection.dropDatabase();
      await connection.close();
    }
  });

  it('saves and reads legacy Cake, Store, User, and Curation shapes', async () => {
    await new cakeModel(fixtures.cake).save({ timestamps: false });
    await new storeModel(fixtures.store).save({ timestamps: false });
    await new userModel(fixtures.user).save({ timestamps: false });
    await new curationModel(fixtures.curation).save({ timestamps: false });

    const [cake, store, user, curation] = await Promise.all([
      cakeModel.findById(fixtures.cake._id).lean(),
      storeModel.findById(fixtures.store._id).lean(),
      userModel.findById(fixtures.user._id).lean(),
      curationModel.findById(fixtures.curation._id).lean(),
    ]);

    expect(jsonValue(cake)).toEqual(fixtures.cake);
    expect(jsonValue(store)).toEqual(fixtures.store);
    expect(jsonValue(user)).toEqual(fixtures.user);
    expect(jsonValue(curation)).toEqual(fixtures.curation);
    expect(curation.cakes[0]).toHaveProperty('legacy_extra', 'must-stay');
  });

  it('applies defaults and casting on real Mongo writes', async () => {
    const cake = await cakeModel.create({
      image: fixtures.cake.image,
      owner_store_id: 'store-defaults',
      faiss_id: '202',
    });
    const store = await storeModel.create({
      name: 'Defaults Store',
      address: 'Seoul',
      owner_user_id: 'seller-defaults',
      taste: [],
    });
    const user = await userModel.create({
      firebaseUid: 'defaults-user',
      nickname: 'Defaults User',
      oauth_provider: 'password',
    });

    expect(cake.faiss_id).toBe(202);
    expect(cake.is_delete).toBe(false);
    const cakeWithTimestamps = cake.toObject() as Cake & {
      createdAt: Date;
      updatedAt: Date;
    };
    expect(cakeWithTimestamps.createdAt).toBeInstanceOf(Date);
    expect(cakeWithTimestamps.updatedAt).toBeInstanceOf(Date);
    expect(store.store_feature).toBe('');
    expect(store.detail_images).toEqual([]);
    expect(user.roles).toEqual(['isBuyer']);
    expect(user.cake_like_ids).toEqual([]);
    expect(user.store_like_ids).toEqual([]);
  });

  it('keeps Curation claim timestamps stable and bumps update timestamps', async () => {
    await new curationModel(fixtures.curation).save({ timestamps: false });
    const repository = new CurationRepository(curationModel);
    const originalUpdatedAt = new Date(fixtures.curation.updatedAt);
    const claimedAt = new Date('2026-07-20T00:10:00.000Z');

    await expect(
      repository.claimRefresh(
        fixtures.curation._id,
        originalUpdatedAt,
        new Date('2026-07-20T00:00:00.000Z'),
        claimedAt,
      ),
    ).resolves.toBe(true);

    const claimed = await curationModel.findById(fixtures.curation._id);
    expect(claimed.updatedAt).toEqual(originalUpdatedAt);
    expect(claimed.refreshClaimedAt).toEqual(claimedAt);

    const view = CurationPersistenceMapper.toView(claimed);
    await repository.updateCakes(view.id, view.cakes);

    const updated = await curationModel.findById(fixtures.curation._id).lean();
    expect(updated.updatedAt.getTime()).toBeGreaterThan(
      originalUpdatedAt.getTime(),
    );
    expect(updated.cakes[0]).toHaveProperty('legacy_extra', 'must-stay');
  });

  it('reads and writes legacy keywordlogs documents without migration', async () => {
    const createdAt = new Date('2026-07-31T12:00:00.000Z');
    await keywordLogModel.collection.insertOne({
      userId: 'legacy-user',
      searchWord: 'legacy-keyword',
      relatedWord: ['cream'],
      createdAt,
      updatedAt: createdAt,
    });
    const repository = new SearchEventRepository(keywordLogModel);

    const latest = await repository.findLatest('legacy-user');
    await repository.record('legacy-user', 'new-keyword', ['chocolate']);
    const inserted = await keywordLogModel
      .findOne({ searchWord: 'new-keyword' })
      .lean();

    expect(keywordLogModel.collection.collectionName).toBe('keywordlogs');
    expect(latest[0]).toMatchObject({
      userId: 'legacy-user',
      searchWord: 'legacy-keyword',
      relatedWord: ['cream'],
    });
    expect(inserted).toMatchObject({
      userId: 'legacy-user',
      searchWord: 'new-keyword',
      relatedWord: ['chocolate'],
    });
    expect(inserted.createdAt).toBeInstanceOf(Date);
    expect(inserted.updatedAt).toBeInstanceOf(Date);
  });

  it('reads and writes legacy cakelikelogs documents without migration', async () => {
    const cakeId = '65a000000000000000000001';
    const createdAt = new Date('2026-07-31T12:00:00.000Z');
    await cakeLikeLogModel.collection.insertOne({
      userId: 'legacy-user',
      cakeId: new ObjectId(cakeId),
      type: true,
      createdAt,
      updatedAt: createdAt,
    });
    const repository = new CakeLikeEventRepository(cakeLikeLogModel);

    const counts = await repository.getNetCounts(
      '2026-07-31T00:00:00.000Z',
      '2026-08-01T00:00:00.000Z',
    );
    await repository.record('legacy-user', cakeId, false);
    const inserted = await cakeLikeLogModel.findOne({ type: false }).lean();

    expect(cakeLikeLogModel.collection.collectionName).toBe('cakelikelogs');
    expect(counts).toEqual([{ cakeId, appLike: 1 }]);
    expect(inserted).toMatchObject({
      userId: 'legacy-user',
      cakeId: new ObjectId(cakeId),
      type: false,
    });
    expect(inserted.createdAt).toBeInstanceOf(Date);
    expect(inserted.updatedAt).toBeInstanceOf(Date);
  });
});
