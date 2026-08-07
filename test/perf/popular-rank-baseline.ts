import {
  Collection,
  Document,
  MongoClient,
  ObjectId,
  OptionalUnlessRequiredId,
} from 'mongodb';
import { MongoPopularRankingSourceAdapter } from '../../src/ranking/infrastructure/persistence/mongo-popular-ranking-source.adapter';
import { PopularRankService } from '../../src/ranking/infrastructure/persistence/read-model/popular-rank.service';
import { rankingConfigFixture } from '../support/typed-config.fixtures';

type Pipeline = Record<string, unknown>[];
type RankedCake = {
  _id: ObjectId;
  total: number;
  image: Record<string, unknown>;
  owner_store_id: string;
  tag_ins: string[];
};
type BuiltRank = {
  rank: number;
  cakeId: string;
  total: number;
  image: Record<string, unknown>;
  owner_store_id: string;
  tag_ins: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CAKE_COUNT = 25_000;
const DEFAULT_EVENT_COUNT = 100_000;
const INSERT_BATCH_SIZE = 10_000;
const FIRST_PAGE_LIMIT = 100;
const NEXT_PAGE_LIMIT = 20;
const READ_MODEL_BATCH_SIZE = 1000;

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function deterministicObjectId(value: number): ObjectId {
  return new ObjectId(value.toString(16).padStart(24, '0'));
}

async function insertBatches<T extends Document>(
  collection: Collection<T>,
  documents: OptionalUnlessRequiredId<T>[],
): Promise<void> {
  for (let index = 0; index < documents.length; index += INSERT_BATCH_SIZE) {
    await collection.insertMany(
      documents.slice(index, index + INSERT_BATCH_SIZE),
      { ordered: false },
    );
  }
}

function legacyPipeline(start: Date, end: Date, after?: number): Pipeline {
  const pipeline: Pipeline = [
    {
      $match: { createdAt: { $gte: start, $lte: end } },
    },
    {
      $group: {
        _id: '$cakeId',
        trueCount: {
          $sum: { $cond: [{ $eq: ['$type', true] }, 1, 0] },
        },
        falseCount: {
          $sum: { $cond: [{ $eq: ['$type', false] }, 1, 0] },
        },
      },
    },
    {
      $addFields: {
        app_like: { $subtract: ['$trueCount', '$falseCount'] },
      },
    },
    {
      $lookup: {
        from: 'cakes',
        localField: '_id',
        foreignField: '_id',
        as: 'cakeInfo',
      },
    },
    { $unwind: '$cakeInfo' },
    { $match: { 'cakeInfo.is_delete': { $ne: true } } },
    {
      $project: {
        _id: 1,
        app_like: 1,
        like_ins: '$cakeInfo.like_ins',
        image: '$cakeInfo.image',
        owner_store_id: '$cakeInfo.owner_store_id',
        tag_ins: '$cakeInfo.tag_ins',
      },
    },
    {
      $addFields: {
        total: {
          $add: [
            { $multiply: [{ $toInt: '$like_ins' }, 0.2] },
            { $multiply: ['$app_like', 0.9] },
          ],
        },
      },
    },
    { $sort: { total: -1, _id: 1 } },
  ];
  if (after !== undefined) {
    pipeline.push({ $match: { total: { $lt: after } } });
  }
  return pipeline;
}

function executionStats(explain: Record<string, any>) {
  const cursor = explain.stages?.[0]?.$cursor?.executionStats;
  const direct = explain.executionStats;
  return cursor ?? direct ?? {};
}

function assertParity(legacy: RankedCake[], built: BuiltRank[]): void {
  if (legacy.length !== built.length) {
    throw new Error(
      `Popular result count changed: ${legacy.length} -> ${built.length}`,
    );
  }
  for (let index = 0; index < legacy.length; index += 1) {
    const before = legacy[index];
    const after = built[index];
    const sameProjection =
      before._id.toString() === String(after.cakeId) &&
      Math.abs(before.total - after.total) <= Number.EPSILON &&
      before.owner_store_id === after.owner_store_id &&
      before.image?.s3Url === after.image?.s3Url &&
      JSON.stringify(before.tag_ins ?? []) === JSON.stringify(after.tag_ins);
    if (!sameProjection) {
      throw new Error(`Popular result parity changed at rank ${index + 1}`);
    }
  }
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGODB_URL ?? 'mongodb://127.0.0.1:27017';
  const cakeCount = positiveInteger(
    'POPULAR_BASELINE_CAKE_COUNT',
    DEFAULT_CAKE_COUNT,
  );
  const eventCount = positiveInteger(
    'POPULAR_BASELINE_EVENT_COUNT',
    DEFAULT_EVENT_COUNT,
  );
  const dbName = `kezzle_phase_c_popular_${process.pid}_${Date.now()}`;
  const client = new MongoClient(mongoUrl);

  await client.connect();
  const db = client.db(dbName);
  const cakes = db.collection('cakes');
  const cakeLikeEvents = db.collection('cakelikelogs');
  const now = new Date();
  const start = new Date(now.getTime() - 30 * DAY_MS);

  try {
    const cakeDocuments = Array.from({ length: cakeCount }, (_, index) => ({
      _id: deterministicObjectId(index + 1),
      like_ins: String((index % 50) + 1),
      image: { s3Url: `https://example.com/cake-${index + 1}.jpg` },
      owner_store_id: `store-${(index % 500) + 1}`,
      tag_ins: [`tag-${index % 20}`],
      user_like_ids: [],
      cursor: `cursor-${index + 1}`,
      is_delete: index % 997 === 0,
    }));
    const eventDocuments = Array.from({ length: eventCount }, (_, index) => ({
      userId: `user-${(index % 10_000) + 1}`,
      cakeId: deterministicObjectId((index % cakeCount) + 1),
      type: index % 4 !== 0,
      createdAt: new Date(now.getTime() - (index % 30) * DAY_MS),
      updatedAt: now,
    }));

    await insertBatches(cakes, cakeDocuments);
    await insertBatches(cakeLikeEvents, eventDocuments);
    await cakeLikeEvents.createIndex({ createdAt: 1 });

    const legacyStartedAt = process.hrtime.bigint();
    const legacyRanked = (await cakeLikeEvents
      .aggregate([...legacyPipeline(start, now), { $limit: FIRST_PAGE_LIMIT }])
      .toArray()) as RankedCake[];
    const legacyWallMs =
      Number(process.hrtime.bigint() - legacyStartedAt) / 1_000_000;

    let sourceQueryCount = 0;
    let sourceQueryMs = 0;
    let sourcePipeline: Pipeline = [];
    let sourceMaxTimeMs: number | undefined;
    let builtRanks: BuiltRank[] = [];

    const sourceConnection = {
      collection: (name: string) => {
        if (name !== 'cakelikelogs') {
          throw new Error(`Unexpected source collection: ${name}`);
        }
        return {
          aggregate: (pipeline: Pipeline, options?: { maxTimeMS?: number }) => {
            sourceQueryCount += 1;
            sourcePipeline = pipeline;
            sourceMaxTimeMs = options?.maxTimeMS;
            return {
              toArray: async () => {
                const queryStartedAt = process.hrtime.bigint();
                const rows = await cakeLikeEvents
                  .aggregate(pipeline, options)
                  .toArray();
                sourceQueryMs =
                  Number(process.hrtime.bigint() - queryStartedAt) / 1_000_000;
                return rows;
              },
            };
          },
        };
      },
    };
    const rankModel = {
      insertMany: async (documents: BuiltRank[]) => {
        builtRanks = documents;
      },
      deleteMany: async () => undefined,
    };
    const sourceReader = new MongoPopularRankingSourceAdapter(
      sourceConnection as never,
    );
    const popularRank = new PopularRankService(
      rankModel as never,
      sourceReader,
      rankingConfigFixture,
    );

    const boundedStartedAt = process.hrtime.bigint();
    await popularRank.refresh();
    const boundedWallMs =
      Number(process.hrtime.bigint() - boundedStartedAt) / 1_000_000;

    assertParity(legacyRanked, builtRanks.slice(0, FIRST_PAGE_LIMIT));
    if (sourceQueryCount !== 1) {
      throw new Error(
        `Popular source query count changed: ${sourceQueryCount}`,
      );
    }
    const sourceLimit = Number(
      sourcePipeline.find((stage) => '$limit' in stage)?.$limit,
    );
    if (sourceLimit !== READ_MODEL_BATCH_SIZE) {
      throw new Error(`Popular source limit changed: ${sourceLimit}`);
    }
    if (sourceMaxTimeMs !== 5000) {
      throw new Error(`Popular source maxTimeMS changed: ${sourceMaxTimeMs}`);
    }

    const first = legacyRanked[0];
    const [firstCake, eventCounts, deletedRankCount] = await Promise.all([
      cakes.findOne({ _id: first._id }),
      cakeLikeEvents
        .aggregate([
          { $match: { cakeId: first._id } },
          {
            $group: {
              _id: '$cakeId',
              trueCount: {
                $sum: { $cond: [{ $eq: ['$type', true] }, 1, 0] },
              },
              falseCount: {
                $sum: { $cond: [{ $eq: ['$type', false] }, 1, 0] },
              },
            },
          },
        ])
        .next(),
      cakes.countDocuments({
        _id: { $in: builtRanks.map((item) => new ObjectId(item.cakeId)) },
        is_delete: true,
      }),
    ]);
    const expectedTotal =
      Number(firstCake?.like_ins) * 0.2 +
      (Number(eventCounts?.trueCount) - Number(eventCounts?.falseCount)) * 0.9;
    if (Math.abs(first.total - expectedTotal) > Number.EPSILON) {
      throw new Error('Popular score formula contract changed');
    }
    if (deletedRankCount !== 0) {
      throw new Error('Deleted cakes appeared in the two-step popular rank');
    }

    const cursor = legacyRanked[Math.min(9, legacyRanked.length - 1)].total;
    const legacyNextPage = (await cakeLikeEvents
      .aggregate([
        ...legacyPipeline(start, now, cursor),
        { $limit: NEXT_PAGE_LIMIT },
      ])
      .toArray()) as RankedCake[];
    const boundedNextPage = builtRanks
      .filter((item) => item.total < cursor)
      .slice(0, NEXT_PAGE_LIMIT);
    assertParity(legacyNextPage, boundedNextPage);
    if (legacyNextPage.some((item) => item.total >= cursor)) {
      throw new Error('Popular source after pagination contract changed');
    }

    const legacyExplain = (await cakeLikeEvents
      .aggregate([...legacyPipeline(start, now), { $limit: FIRST_PAGE_LIMIT }])
      .explain('executionStats')) as Record<string, any>;
    const sourceExplain = (await cakeLikeEvents
      .aggregate(sourcePipeline, { maxTimeMS: sourceMaxTimeMs })
      .explain('executionStats')) as Record<string, any>;
    const legacyStats = executionStats(legacyExplain);
    const sourceStats = executionStats(sourceExplain);

    console.log(
      JSON.stringify(
        {
          fixture: {
            database: dbName,
            cakes: cakeCount,
            cakeLikeEvents: eventCount,
            activeWindowDays: 30,
          },
          contract: {
            parity: true,
            resultCount: builtRanks.length,
            firstCakeId: String(builtRanks[0].cakeId),
            firstTotal: builtRanks[0].total,
            expectedFirstTotal: expectedTotal,
            deletedRankCount,
            afterCursor: cursor,
            paginationParity: true,
            sourceNextPageResultCount: legacyNextPage.length,
            readModelNextPageResultCount: boundedNextPage.length,
            sourceQueryCount,
            sourceLimit,
            sourceMaxTimeMs,
          },
          performance: {
            legacy: {
              wallDurationMs: Number(legacyWallMs.toFixed(2)),
              explainExecutionTimeMillis:
                legacyStats.executionTimeMillis ?? null,
              totalKeysExamined: legacyStats.totalKeysExamined ?? null,
              totalDocsExamined: legacyStats.totalDocsExamined ?? null,
            },
            boundedSource: {
              wallDurationMs: Number(boundedWallMs.toFixed(2)),
              sourceQueryMs: Number(sourceQueryMs.toFixed(2)),
              explainExecutionTimeMillis:
                sourceStats.executionTimeMillis ?? null,
              totalKeysExamined: sourceStats.totalKeysExamined ?? null,
              totalDocsExamined: sourceStats.totalDocsExamined ?? null,
            },
            wallDeltaMs: Number((boundedWallMs - legacyWallMs).toFixed(2)),
            wallRatio: Number((boundedWallMs / legacyWallMs).toFixed(3)),
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await db.dropDatabase();
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
