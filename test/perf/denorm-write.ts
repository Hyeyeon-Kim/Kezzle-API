import mongoose from 'mongoose';
import { Store, StoreSchema } from '../../src/store/entities/store.schema';
import { Cake, CakeSchema } from '../../src/cake/entities/cake.schema';

type Percentiles = {
  p50: number;
  p95: number;
  p99: number;
};

type WriteResult = {
  cakesPerStore: number;
  iterations: number;
  matchedPerIter: number;
  modifiedPerIter: number;
  durationMs: Percentiles;
};

const WRITE_OWNER_USER_ID = 'kan-20-denorm-write';
const WRITE_CAKE_CURSOR = 'kan-20-denorm-write-cursor';
const DEFAULT_CAKES_PER_STORE = [10, 100, 1000];
const DEFAULT_ITERATIONS = 100;
const DEFAULT_WARMUP = 10;

function getEnvNumber(name: string, defaultValue: number): number {
  const value = Number(process.env[name]);
  return Number.isNaN(value) || value <= 0 ? defaultValue : value;
}

function getCakesPerStoreList(): number[] {
  const raw = process.env.WRITE_CAKES_PER_STORE;

  if (!raw) {
    return DEFAULT_CAKES_PER_STORE;
  }

  const values = raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => !Number.isNaN(value) && value > 0);

  return values.length > 0 ? values : DEFAULT_CAKES_PER_STORE;
}

function elapsedMs(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

function percentile(values: number[], pct: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
}

function toPercentiles(values: number[]): Percentiles {
  return {
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
  };
}

function formatMs(value: number): string {
  return `${value.toFixed(2)}ms`;
}

async function measureWriteCost(
  storeModel: mongoose.Model<Store>,
  cakeModel: mongoose.Model<Cake>,
  cakesPerStore: number,
  iterations: number,
  warmupIterations: number,
): Promise<WriteResult> {
  await cakeModel.deleteMany({ cursor: WRITE_CAKE_CURSOR });
  await storeModel.deleteMany({ owner_user_id: WRITE_OWNER_USER_ID });

  const [seedStore] = await storeModel.insertMany([
    {
      name: 'KAN20 Write Baseline Store',
      address: 'Seoul write address',
      owner_user_id: WRITE_OWNER_USER_ID,
      taste: ['vanilla', 'choco'],
      location: { type: 'Point', coordinates: [127, 37] },
      user_like_ids: [],
      detail_images: [],
      operating_time: [],
    },
  ]);
  const storeId = seedStore._id.toString();

  const faissIdBase = Date.now() * 1000;
  await cakeModel.insertMany(
    Array.from({ length: cakesPerStore }, (_, index) => ({
      image: { s3Url: `https://example.com/write-cake-${index + 1}.jpg` },
      owner_store_id: storeId,
      cursor: WRITE_CAKE_CURSOR,
      tag_ins: ['baseline'],
      user_like_ids: [],
      is_delete: false,
      faiss_id: faissIdBase + index,
      owner_store_snapshot: {
        name: seedStore.name,
        address: seedStore.address,
        taste: seedStore.taste,
        latitude: String(seedStore.location.coordinates[1]),
        longitude: String(seedStore.location.coordinates[0]),
      },
    })),
  );

  let lastResult = { matchedCount: 0, modifiedCount: 0 };

  for (let iter = 0; iter < warmupIterations; iter += 1) {
    await cakeModel.updateMany(
      { owner_store_id: storeId },
      {
        $set: {
          'owner_store_snapshot.name': `Warmup Store ${iter}`,
          'owner_store_snapshot.taste':
            iter % 2 === 0 ? ['vanilla'] : ['choco'],
        },
      },
    );
  }

  const durations: number[] = [];

  for (let iter = 0; iter < iterations; iter += 1) {
    const start = process.hrtime.bigint();
    const result = await cakeModel.updateMany(
      { owner_store_id: storeId },
      {
        $set: {
          'owner_store_snapshot.name': `Updated Store ${iter}`,
          'owner_store_snapshot.taste':
            iter % 2 === 0 ? ['vanilla'] : ['choco'],
        },
      },
    );
    durations.push(elapsedMs(start));
    lastResult = {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    };
  }

  await cakeModel.deleteMany({ cursor: WRITE_CAKE_CURSOR });
  await storeModel.deleteMany({ owner_user_id: WRITE_OWNER_USER_ID });

  return {
    cakesPerStore,
    iterations,
    matchedPerIter: lastResult.matchedCount,
    modifiedPerIter: lastResult.modifiedCount,
    durationMs: toPercentiles(durations),
  };
}

function printResults(results: WriteResult[]): void {
  console.log(
    [
      '| cakes per store | iterations | matched/iter | modified/iter | p50 | p95 | p99 |',
      '| ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
      ...results.map((r) =>
        [
          `| ${r.cakesPerStore}`,
          r.iterations,
          r.matchedPerIter,
          r.modifiedPerIter,
          formatMs(r.durationMs.p50),
          formatMs(r.durationMs.p95),
          `${formatMs(r.durationMs.p99)} |`,
        ].join(' | '),
      ),
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGODB_URL;

  if (!mongoUrl) {
    throw new Error('MONGODB_URL is required');
  }

  const iterations = getEnvNumber('WRITE_ITERATIONS', DEFAULT_ITERATIONS);
  const warmup = getEnvNumber('WRITE_WARMUP', DEFAULT_WARMUP);
  const cakesPerStoreList = getCakesPerStoreList();
  const debug = process.env.WRITE_DEBUG === '1';

  if (debug) {
    mongoose.set('debug', (collectionName, methodName, ...args) => {
      console.log(
        `[mongoose] ${collectionName}.${methodName}`,
        JSON.stringify(args[0] ?? null),
      );
    });
  }

  const connection = await mongoose.createConnection(mongoUrl, {
    user: process.env.MONGODB_USERNAME,
    pass: process.env.MONGODB_PASSWORD,
    dbName: process.env.MONGODB_DBNAME_MAIN,
    monitorCommands: debug,
  });

  if (debug) {
    const client = connection.getClient();
    client.on('commandStarted', (event) => {
      if (['update', 'updateMany', 'bulkWrite'].includes(event.commandName)) {
        console.log(
          `[write-cmd] ${event.commandName}`,
          JSON.stringify(event.command),
        );
      }
    });
    client.on('commandSucceeded', (event) => {
      if (['update', 'updateMany', 'bulkWrite'].includes(event.commandName)) {
        console.log(`[write-cmd-ok] ${event.commandName} ${event.duration}ms`);
      }
    });
  }

  const storeModel = connection.model(Store.name, StoreSchema);
  const cakeModel = connection.model(Cake.name, CakeSchema);

  try {
    const results: WriteResult[] = [];

    for (const cakesPerStore of cakesPerStoreList) {
      results.push(
        await measureWriteCost(
          storeModel,
          cakeModel,
          cakesPerStore,
          iterations,
          warmup,
        ),
      );
    }

    printResults(results);
  } finally {
    await cakeModel.deleteMany({ cursor: WRITE_CAKE_CURSOR });
    await storeModel.deleteMany({ owner_user_id: WRITE_OWNER_USER_ID });
    await connection.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
