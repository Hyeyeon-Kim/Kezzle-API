import { Connection, Model, createConnection } from 'mongoose';
import { ObjectId } from 'mongodb';
import {
  CakePersistenceModel,
  CakeSchema,
} from 'src/cake/infrastructure/persistence/schema/cake.schema';
import { CurationPersistenceMapper } from 'src/curation/infrastructure/persistence/curation.persistence-mapper';
import { CurationRepository } from 'src/curation/infrastructure/persistence/curation.repository';
import {
  Curation,
  CurationSchema,
} from 'src/curation/infrastructure/persistence/schema/curation.schema';
import { Store, StoreSchema } from 'src/store/infrastructure/persistence/schema/store.schema';
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
import {
  KeywordRank,
  KeywordRankSchema,
} from 'src/ranking/infrastructure/persistence/keyword-rank.schema';
import {
  PopularCakeRank,
  PopularCakeRankSchema,
} from 'src/ranking/infrastructure/persistence/popular-cake-rank.schema';
import { KeywordRankService } from 'src/ranking/infrastructure/persistence/read-model/keyword-rank.service';
import { PopularRankService } from 'src/ranking/infrastructure/persistence/read-model/popular-rank.service';
import { RankingQueryService } from 'src/ranking/application/query/ranking-query.service';
import { MongoPopularRankingSourceAdapter } from 'src/ranking/infrastructure/persistence/mongo-popular-ranking-source.adapter';
import { User, UserSchema } from 'src/user/infrastructure/persistence/schema/user.schema';
import fixtures from './fixtures/legacy-persistence.contract.json';
import { rankingConfigFixture } from './support/typed-config.fixtures';

function jsonValue(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe('Persistence Mongo integration contract', () => {
  let connection: Connection;
  let cakeModel: Model<CakePersistenceModel>;
  let storeModel: Model<Store>;
  let userModel: Model<User>;
  let curationModel: Model<Curation>;
  let keywordLogModel: Model<KeywordLog>;
  let cakeLikeLogModel: Model<CakeLikeLog>;
  let keywordRankModel: Model<KeywordRank>;
  let popularCakeRankModel: Model<PopularCakeRank>;

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
    keywordRankModel = connection.model(
      'ContractKeywordRank',
      KeywordRankSchema,
    );
    popularCakeRankModel = connection.model(
      'ContractPopularCakeRank',
      PopularCakeRankSchema,
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
      keywordRankModel.deleteMany({}),
      popularCakeRankModel.deleteMany({}),
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
    expect(cake.image).not.toHaveProperty('_id');
    expect(store.logo).not.toHaveProperty('_id');
    expect(store.detail_images[0]).not.toHaveProperty('_id');
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
    const cakeWithTimestamps = cake.toObject() as CakePersistenceModel & {
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

    await repository.record('legacy-user', cakeId, false);
    const inserted = await cakeLikeLogModel.findOne({ type: false }).lean();

    expect(cakeLikeLogModel.collection.collectionName).toBe('cakelikelogs');
    expect(inserted).toMatchObject({
      userId: 'legacy-user',
      cakeId: new ObjectId(cakeId),
      type: false,
    });
    expect(inserted.createdAt).toBeInstanceOf(Date);
    expect(inserted.updatedAt).toBeInstanceOf(Date);
  });

  it('bounds popular source results and normalizes invalid legacy like scores', async () => {
    const ids = {
      invalid: new ObjectId('65a000000000000000000001'),
      missing: new ObjectId('65a000000000000000000002'),
      numeric: new ObjectId('65a000000000000000000003'),
      deleted: new ObjectId('65a000000000000000000004'),
      infinite: new ObjectId('65a000000000000000000005'),
    };
    const image = {
      name: 'cake.png',
      converte_name: 'cake-converted.png',
      key: 'store-1/cakes/cake-converted.png',
      s3Url: 'https://cdn.example.com/cake.png',
    };
    const createdAt = new Date('2026-08-01T12:00:00.000Z');
    await cakeModel.collection.insertMany([
      {
        _id: ids.invalid,
        image,
        owner_store_id: 'store-1',
        like_ins: 'not-a-number',
        tag_ins: ['invalid'],
        is_delete: false,
        faiss_id: 1001,
      },
      {
        _id: ids.missing,
        image,
        owner_store_id: 'store-1',
        tag_ins: ['missing'],
        is_delete: false,
        faiss_id: 1002,
      },
      {
        _id: ids.numeric,
        image,
        owner_store_id: 'store-1',
        like_ins: '20',
        tag_ins: ['numeric'],
        is_delete: false,
        faiss_id: 1003,
      },
      {
        _id: ids.deleted,
        image,
        owner_store_id: 'store-1',
        like_ins: '1000',
        tag_ins: ['deleted'],
        is_delete: true,
        faiss_id: 1004,
      },
      {
        _id: ids.infinite,
        image,
        owner_store_id: 'store-1',
        like_ins: 'Infinity',
        tag_ins: ['infinite'],
        is_delete: false,
        faiss_id: 1005,
      },
    ]);
    await cakeLikeLogModel.collection.insertMany(
      Object.values(ids).map((cakeId) => ({
        userId: `user-${cakeId}`,
        cakeId,
        type: true,
        createdAt,
        updatedAt: createdAt,
      })),
    );
    const reader = new MongoPopularRankingSourceAdapter(connection);

    const ranked = await reader.findTop({
      start: new Date('2026-08-01T00:00:00.000Z'),
      end: new Date('2026-08-02T00:00:00.000Z'),
      limit: 4,
      maxTimeMs: 1000,
    });

    expect(ranked).toHaveLength(4);
    expect(ranked).toEqual([
      expect.objectContaining({
        cakeId: String(ids.numeric),
        total: 4.9,
        tags: ['numeric'],
      }),
      expect.objectContaining({
        cakeId: String(ids.invalid),
        total: 0.9,
        tags: ['invalid'],
      }),
      expect.objectContaining({
        cakeId: String(ids.missing),
        total: 0.9,
        tags: ['missing'],
      }),
      expect.objectContaining({
        cakeId: String(ids.infinite),
        total: 0.9,
        tags: ['infinite'],
      }),
    ]);
    expect(ranked.every((cake) => Number.isFinite(cake.total))).toBe(true);
    expect(ranked.some((cake) => cake.cakeId === String(ids.deleted))).toBe(
      false,
    );
  });

  it('reuses legacy keyword and popular rank read models without migration', async () => {
    const cakeId = '65a000000000000000000002';
    const computedAt = new Date('2026-07-31T12:00:00.000Z');
    await keywordRankModel.collection.insertOne({
      rank: 1,
      searchWord: 'legacy-rank',
      count: 8,
      computedAt,
      isEmptyBatch: false,
    });
    await popularCakeRankModel.collection.insertOne({
      rank: 1,
      cakeId: new ObjectId(cakeId),
      total: 12.5,
      image: {
        name: 'legacy.png',
        converte_name: 'legacy-converted.png',
        key: 'cakes/legacy-converted.png',
        s3Url: 'https://cdn.example.com/legacy.png',
      },
      owner_store_id: 'store-legacy',
      tag_ins: [],
      computedAt,
      isEmptyBatch: false,
    });

    const keywordRankService = new KeywordRankService(
      keywordRankModel,
      { getRanked: jest.fn() } as never,
      rankingConfigFixture,
    );
    const popularRankService = new PopularRankService(
      popularCakeRankModel,
      { findTop: jest.fn() } as never,
      rankingConfigFixture,
    );
    const query = new RankingQueryService(
      keywordRankService,
      popularRankService,
      { getRanked: jest.fn() } as never,
      rankingConfigFixture,
    );

    const [keyword, popular] = await Promise.all([
      query.getKeywordRank(undefined, undefined, 10),
      query.getPopularCakes(NaN, 20),
    ]);

    expect(keywordRankModel.collection.collectionName).toBe('keywordranks');
    expect(popularCakeRankModel.collection.collectionName).toBe(
      'popularcakeranks',
    );
    expect(keyword.ranking).toEqual([{ id: 'legacy-rank', count: 8 }]);
    expect(popular.cakes).toEqual([
      expect.objectContaining({
        id: cakeId,
        ownerStoreId: 'store-legacy',
        tags: [],
        calculatedLikes: 12.5,
      }),
    ]);
    expect(keyword.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(popular.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
