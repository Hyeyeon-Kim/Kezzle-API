import {
  Collection,
  Document,
  MongoClient,
  ObjectId,
  OptionalUnlessRequiredId,
} from 'mongodb';
import { LogService } from '../../src/log/log.service';

type Pipeline = Record<string, unknown>[];

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

function stageSummary(explain: Record<string, any>) {
  return (explain.stages ?? []).map((stage: Record<string, any>) => {
    const [name, details] = Object.entries(stage)[0] as [string, any];
    return {
      name,
      nReturned:
        details?.nReturned ?? details?.executionStats?.nReturned ?? null,
      executionTimeMillisEstimate:
        details?.executionTimeMillisEstimate ??
        details?.executionStats?.executionTimeMillis ??
        null,
    };
  });
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
  const dbName = `kezzle_phase_a_popular_${process.pid}_${Date.now()}`;
  const client = new MongoClient(mongoUrl);

  await client.connect();
  const db = client.db(dbName);
  const cakes = db.collection('cakes');
  const cakeLikeEvents = db.collection('cakelikelogs');
  const now = new Date();
  const start = new Date(now.getTime() - 30 * DAY_MS);
  const pipelines: Pipeline[] = [];

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

    const aggregateAdapter = {
      aggregate: (pipeline: Pipeline) => {
        pipelines.push(pipeline);
        return {
          limit: (limit: number) =>
            cakeLikeEvents
              .aggregate([...pipeline, { $limit: limit }])
              .toArray(),
        };
      },
    };
    const logService = new LogService({} as never, aggregateAdapter as never);

    const startedAt = process.hrtime.bigint();
    const ranked = await logService.getRankCake(
      start.toISOString(),
      now.toISOString(),
      Number.NaN,
      100,
    );
    const wallDurationMs =
      Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    if (ranked.length === 0) {
      throw new Error('Popular baseline returned no ranked cakes');
    }
    for (let index = 1; index < ranked.length; index += 1) {
      const previous = ranked[index - 1];
      const current = ranked[index];
      if (previous.total < current.total) {
        throw new Error('Popular baseline total sort contract changed');
      }
      if (
        previous.total === current.total &&
        previous._id.toString() > current._id.toString()
      ) {
        throw new Error('Popular baseline Cake ID tie-break contract changed');
      }
    }

    const first = ranked[0];
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
        _id: { $in: ranked.map((item) => item._id) },
        is_delete: true,
      }),
    ]);
    const expectedTotal =
      Number(firstCake?.like_ins) * 0.2 +
      (Number(eventCounts?.trueCount) - Number(eventCounts?.falseCount)) * 0.9;
    if (Math.abs(first.total - expectedTotal) > Number.EPSILON) {
      throw new Error('Popular baseline score formula contract changed');
    }
    if (deletedRankCount !== 0) {
      throw new Error('Deleted cakes appeared in popular baseline');
    }

    const cursor = ranked[Math.min(9, ranked.length - 1)].total;
    const nextPage = await logService.getRankCake(
      start.toISOString(),
      now.toISOString(),
      cursor,
      20,
    );
    if (nextPage.some((item) => item.total >= cursor)) {
      throw new Error('Popular baseline after pagination contract changed');
    }

    const explainedPipeline = [...pipelines[0], { $limit: 100 }];
    const explain = (await cakeLikeEvents
      .aggregate(explainedPipeline)
      .explain('executionStats')) as Record<string, any>;
    const cursorStats = explain.stages?.[0]?.$cursor?.executionStats ?? {};
    const indexes = await cakeLikeEvents.indexes();

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
            resultCount: ranked.length,
            firstCakeId: first._id.toString(),
            firstTotal: first.total,
            expectedFirstTotal: expectedTotal,
            deletedRankCount,
            afterCursor: cursor,
            nextPageResultCount: nextPage.length,
          },
          performance: {
            wallDurationMs: Number(wallDurationMs.toFixed(2)),
            explainExecutionTimeMillis: cursorStats.executionTimeMillis ?? null,
            totalKeysExamined: cursorStats.totalKeysExamined ?? null,
            totalDocsExamined: cursorStats.totalDocsExamined ?? null,
            indexes: indexes.map((index) => index.name),
            stages: stageSummary(explain),
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
