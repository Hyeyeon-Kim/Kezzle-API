import {
  Collection,
  Document,
  MongoClient,
  ObjectId,
  OptionalUnlessRequiredId,
} from 'mongodb';
import { CakeRankingRepositoryAdapter } from '../../src/cake/cake-ranking.adapter';
import { CakeRepository } from '../../src/cake/cake.repository';
import { CakeLikeEventRepository } from '../../src/like/infrastructure/persistence/cake-like-event.repository';
import { PopularRankService } from '../../src/ranking/popular-rank.service';

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
      .aggregate([...legacyPipeline(start, now), { $limit: 100 }])
      .toArray()) as RankedCake[];
    const legacyWallMs =
      Number(process.hrtime.bigint() - legacyStartedAt) / 1_000_000;

    let eventQueryCount = 0;
    let cakeQueryCount = 0;
    let eventQueryMs = 0;
    let cakeQueryMs = 0;
    let eventPipeline: Pipeline = [];
    let eventCakeIds: ObjectId[] = [];
    let builtRanks: BuiltRank[] = [];

    const eventModel = {
      aggregate: (pipeline: Pipeline) => {
        eventQueryCount += 1;
        eventPipeline = pipeline;
        const queryStartedAt = process.hrtime.bigint();
        const aggregate = cakeLikeEvents
          .aggregate(pipeline)
          .toArray()
          .then((rows) => {
            eventQueryMs =
              Number(process.hrtime.bigint() - queryStartedAt) / 1_000_000;
            eventCakeIds = rows.map((row) => row._id as ObjectId);
            return rows;
          }) as Promise<Record<string, unknown>[]> & {
          option: () => Promise<Record<string, unknown>[]>;
        };
        aggregate.option = () => aggregate;
        return aggregate;
      },
    };
    const cakeModel = {
      find: (filter: Record<string, unknown>, projection: Document) => {
        cakeQueryCount += 1;
        const ids = (filter._id as { $in: string[] }).$in;
        const castFilter = {
          ...filter,
          _id: { $in: ids.map((id) => new ObjectId(id)) },
        };
        return {
          lean: async () => {
            const queryStartedAt = process.hrtime.bigint();
            const rows = await cakes.find(castFilter, { projection }).toArray();
            cakeQueryMs =
              Number(process.hrtime.bigint() - queryStartedAt) / 1_000_000;
            return rows;
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
    const eventReader = new CakeLikeEventRepository(eventModel as never);
    const cakeRepository = new CakeRepository(cakeModel as never);
    const cakeReader = new CakeRankingRepositoryAdapter(cakeRepository);
    const popularRank = new PopularRankService(
      rankModel as never,
      eventReader,
      cakeReader,
    );

    const twoStepStartedAt = process.hrtime.bigint();
    await popularRank.refresh();
    const twoStepWallMs =
      Number(process.hrtime.bigint() - twoStepStartedAt) / 1_000_000;

    assertParity(legacyRanked, builtRanks);
    if (eventQueryCount !== 1 || cakeQueryCount !== 1) {
      throw new Error(
        `Popular two-step query count changed: event=${eventQueryCount}, cake=${cakeQueryCount}`,
      );
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
      .aggregate([...legacyPipeline(start, now, cursor), { $limit: 20 }])
      .toArray()) as RankedCake[];
    const legacyReadModelNextPage = legacyRanked
      .filter((item) => item.total < cursor)
      .slice(0, 20);
    const twoStepNextPage = builtRanks
      .filter((item) => item.total < cursor)
      .slice(0, 20);
    assertParity(legacyReadModelNextPage, twoStepNextPage);
    if (legacyNextPage.some((item) => item.total >= cursor)) {
      throw new Error('Popular source after pagination contract changed');
    }

    const legacyExplain = (await cakeLikeEvents
      .aggregate([...legacyPipeline(start, now), { $limit: 100 }])
      .explain('executionStats')) as Record<string, any>;
    const eventExplain = (await cakeLikeEvents
      .aggregate(eventPipeline)
      .explain('executionStats')) as Record<string, any>;
    const cakeExplain = (await cakes
      .find(
        { _id: { $in: eventCakeIds }, is_delete: { $ne: true } },
        {
          projection: {
            image: 1,
            owner_store_id: 1,
            like_ins: 1,
            tag_ins: 1,
          },
        },
      )
      .explain('executionStats')) as Record<string, any>;
    const legacyStats = executionStats(legacyExplain);
    const eventStats = executionStats(eventExplain);
    const cakeStats = executionStats(cakeExplain);

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
            sourceNextPageResultCount: legacyNextPage.length,
            readModelNextPageResultCount: twoStepNextPage.length,
            eventQueryCount,
            cakeQueryCount,
          },
          performance: {
            legacy: {
              wallDurationMs: Number(legacyWallMs.toFixed(2)),
              explainExecutionTimeMillis:
                legacyStats.executionTimeMillis ?? null,
              totalKeysExamined: legacyStats.totalKeysExamined ?? null,
              totalDocsExamined: legacyStats.totalDocsExamined ?? null,
            },
            twoStep: {
              wallDurationMs: Number(twoStepWallMs.toFixed(2)),
              eventQueryMs: Number(eventQueryMs.toFixed(2)),
              cakeQueryMs: Number(cakeQueryMs.toFixed(2)),
              eventExplainExecutionTimeMillis:
                eventStats.executionTimeMillis ?? null,
              eventKeysExamined: eventStats.totalKeysExamined ?? null,
              eventDocsExamined: eventStats.totalDocsExamined ?? null,
              cakeExplainExecutionTimeMillis:
                cakeStats.executionTimeMillis ?? null,
              cakeKeysExamined: cakeStats.totalKeysExamined ?? null,
              cakeDocsExamined: cakeStats.totalDocsExamined ?? null,
            },
            wallDeltaMs: Number((twoStepWallMs - legacyWallMs).toFixed(2)),
            wallRatio: Number((twoStepWallMs / legacyWallMs).toFixed(3)),
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
