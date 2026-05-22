import mongoose from 'mongoose';
import { Store, StoreSchema } from '../../src/store/entities/store.schema';
import { Cake, CakeSchema } from '../../src/cake/entities/cake.schema';
import { StoreSimpleResponseDto } from '../../src/store/dto/response-simple-store.dto';
import { CakeSimilarResponseDto } from '../../src/cake/dto/response-similar-cake.dto';

type ScenarioResult = {
  scenario: string;
  iterations: number;
  warmupIterations: number;
  cakeResultSize: number;
  uniqueStoreIds: number;
  storeCalls: number;
  mode: BaselineMode;
  duplication: BaselineDuplication;
  total: Percentiles;
  ai: Percentiles;
  storeHydration: Percentiles;
};

type Percentiles = {
  p50: number;
  p95: number;
  p99: number;
};

type MockCake = {
  id: string;
  image: {
    s3Url: string;
  };
  owner_store_id: string;
  cursor: string;
  tag_ins: string[];
  user_like_ids: string[];
  score: number;
};

type BaselineMode = 'current' | 'batch' | 'lookup';

type BaselineDuplication = 'low' | 'mid' | 'high';

const DEFAULT_STORE_COUNT = 200;
const DEFAULT_ITERATIONS = 100;
const DEFAULT_WARMUP_ITERATIONS = 10;
const DEFAULT_SIZES = [10, 20, 50];
const DEFAULT_DUPLICATIONS: BaselineDuplication[] = ['low', 'mid', 'high'];
const BASELINE_OWNER_USER_ID = 'kan-16-baseline-user';
const BASELINE_CAKE_CURSOR = 'kan-19-baseline-cursor';

const DUPLICATION_DIVISOR: Record<BaselineDuplication, number> = {
  low: 1,
  mid: 2,
  high: 5,
};

function getEnvNumber(name: string, defaultValue: number): number {
  const value = Number(process.env[name]);
  return Number.isNaN(value) || value <= 0 ? defaultValue : value;
}

function getScenarioSizes(): number[] {
  const raw = process.env.BASELINE_SIZES;

  if (!raw) {
    return DEFAULT_SIZES;
  }

  const sizes = raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => !Number.isNaN(value) && value > 0);

  return sizes.length > 0 ? sizes : DEFAULT_SIZES;
}

function getBaselineMode(): BaselineMode {
  const raw = process.env.BASELINE_MODE;

  if (raw === 'batch' || raw === 'lookup') {
    return raw;
  }

  return 'current';
}

function getBaselineDuplications(): BaselineDuplication[] {
  const raw = process.env.BASELINE_DUPLICATION;

  if (!raw) {
    return DEFAULT_DUPLICATIONS;
  }

  const values = raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(
      (value): value is BaselineDuplication => value in DUPLICATION_DIVISOR,
    );

  return values.length > 0 ? values : DEFAULT_DUPLICATIONS;
}

function computeUniquePoolSize(
  size: number,
  duplication: BaselineDuplication,
): number {
  return Math.max(1, Math.round(size / DUPLICATION_DIVISOR[duplication]));
}

function isDebugEnabled(): boolean {
  return process.env.BASELINE_DEBUG === '1';
}

function elapsedMs(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
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

function generateMockCakes(size: number, storeIds: string[]): MockCake[] {
  return Array.from({ length: size }, (_, index) => {
    const storeId = storeIds[index % storeIds.length];

    return {
      id: `baseline-cake-${size}-${index + 1}`,
      image: {
        s3Url: `https://example.com/baseline-cake-${size}-${index + 1}.jpg`,
      },
      owner_store_id: storeId,
      cursor: `baseline-cursor-${size}-${index + 1}`,
      tag_ins: ['baseline'],
      user_like_ids: [],
      score: index / 100,
    };
  });
}

type SeededCake = {
  _id: mongoose.Types.ObjectId;
  owner_store_id: string;
};

async function seedCakes(
  cakeModel: mongoose.Model<Cake>,
  size: number,
  storePool: string[],
): Promise<SeededCake[]> {
  await cakeModel.deleteMany({ cursor: BASELINE_CAKE_CURSOR });

  const faissIdBase = Date.now() * 1000;
  const docs = Array.from({ length: size }, (_, index) => ({
    image: {
      s3Url: `https://example.com/baseline-cake-${size}-${index + 1}.jpg`,
    },
    owner_store_id: storePool[index % storePool.length],
    cursor: BASELINE_CAKE_CURSOR,
    tag_ins: ['baseline'],
    user_like_ids: [],
    is_delete: false,
    faiss_id: faissIdBase + index,
  }));

  const inserted = await cakeModel.insertMany(docs);

  return inserted.map((cake) => ({
    _id: cake._id as mongoose.Types.ObjectId,
    owner_store_id: cake.owner_store_id,
  }));
}

function mockCakesFromSeed(seeded: SeededCake[]): MockCake[] {
  return seeded.map((cake, index) => ({
    id: cake._id.toString(),
    image: {
      s3Url: `https://example.com/baseline-cake-${index + 1}.jpg`,
    },
    owner_store_id: cake.owner_store_id,
    cursor: `${BASELINE_CAKE_CURSOR}-${index + 1}`,
    tag_ins: ['baseline'],
    user_like_ids: [],
    score: index / 100,
  }));
}

async function seedStores(
  storeModel: mongoose.Model<Store>,
  storeCount: number,
): Promise<string[]> {
  await storeModel.deleteMany({ owner_user_id: BASELINE_OWNER_USER_ID });

  const stores = await storeModel.insertMany(
    Array.from({ length: storeCount }, (_, index) => ({
      name: `KAN16 Baseline Store ${index + 1}`,
      address: `Seoul baseline address ${index + 1}`,
      owner_user_id: BASELINE_OWNER_USER_ID,
      taste: ['vanilla', 'choco'],
      location: {
        type: 'Point',
        coordinates: [127 + index / 10000, 37 + index / 10000],
      },
      user_like_ids: [],
      detail_images: [],
      operating_time: [],
    })),
  );

  return stores.map((store) => store._id.toString());
}

type IterationResult = {
  aiMs: number;
  hydrationMs: number;
  totalMs: number;
  uniqueStoreIds: number;
  storeCalls: number;
};

async function runIteration(
  storeModel: mongoose.Model<Store>,
  cakeModel: mongoose.Model<Cake>,
  size: number,
  storePool: string[],
  seededCakes: SeededCake[],
  mode: BaselineMode,
): Promise<IterationResult> {
  const totalStart = process.hrtime.bigint();

  const aiStart = process.hrtime.bigint();
  const cakes =
    mode === 'lookup'
      ? mockCakesFromSeed(seededCakes)
      : generateMockCakes(size, storePool);
  const aiMs = elapsedMs(aiStart);

  const uniqueStoreIds = new Set(cakes.map((cake) => cake.owner_store_id)).size;

  const storeHydrationStart = process.hrtime.bigint();
  let storeCalls = 0;
  let responses: CakeSimilarResponseDto[];

  if (mode === 'batch') {
    const targetStoreIds = [
      ...new Set(cakes.map((cake) => cake.owner_store_id).filter(Boolean)),
    ];
    storeCalls = 1;
    const stores = await storeModel.find({
      _id: {
        $in: targetStoreIds,
      },
    });
    const storeMap = new Map(
      stores.map((store) => [store._id.toString(), store]),
    );

    responses = cakes
      .map((cake) => {
        const store = storeMap.get(cake.owner_store_id);

        if (!store) {
          return null;
        }

        return new CakeSimilarResponseDto(
          cake,
          new StoreSimpleResponseDto(store),
        );
      })
      .filter((cake) => cake !== null);
  } else if (mode === 'lookup') {
    const cakeObjectIds = seededCakes.map((cake) => cake._id);
    storeCalls = 1;
    const rows = await cakeModel.aggregate<{
      _id: mongoose.Types.ObjectId;
      image: { s3Url: string };
      owner_store_id: string;
      store: Store & { _id: mongoose.Types.ObjectId };
    }>([
      { $match: { _id: { $in: cakeObjectIds } } },
      {
        $lookup: {
          from: 'stores',
          let: { storeId: { $toObjectId: '$owner_store_id' } },
          pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$storeId'] } } }],
          as: 'store',
        },
      },
      { $unwind: '$store' },
    ]);

    responses = rows.map(
      (row) =>
        new CakeSimilarResponseDto(
          {
            id: row._id.toString(),
            image: row.image,
            owner_store_id: row.owner_store_id,
          },
          new StoreSimpleResponseDto(row.store),
        ),
    );
  } else {
    responses = await Promise.all(
      cakes.map(async (cake) => {
        const store = await storeModel.findById(cake.owner_store_id);

        return new CakeSimilarResponseDto(
          cake,
          new StoreSimpleResponseDto(store),
        );
      }),
    );
    storeCalls = cakes.length;
  }

  const hydrationMs = elapsedMs(storeHydrationStart);

  if (responses.length !== size) {
    throw new Error(
      `Unexpected response length. expected=${size}, actual=${responses.length}`,
    );
  }

  const totalMs = elapsedMs(totalStart);

  return { aiMs, hydrationMs, totalMs, uniqueStoreIds, storeCalls };
}

async function measureScenario(
  storeModel: mongoose.Model<Store>,
  cakeModel: mongoose.Model<Cake>,
  size: number,
  iterations: number,
  warmupIterations: number,
  storeIds: string[],
  mode: BaselineMode,
  duplication: BaselineDuplication,
): Promise<ScenarioResult> {
  const uniquePoolSize = Math.min(
    computeUniquePoolSize(size, duplication),
    storeIds.length,
  );
  const storePool = storeIds.slice(0, uniquePoolSize);
  const seededCakes = await seedCakes(cakeModel, size, storePool);

  try {
    for (let iteration = 0; iteration < warmupIterations; iteration += 1) {
      await runIteration(
        storeModel,
        cakeModel,
        size,
        storePool,
        seededCakes,
        mode,
      );
    }

    const totalDurations: number[] = [];
    const aiDurations: number[] = [];
    const storeHydrationDurations: number[] = [];
    let storeCalls = 0;
    let uniqueStoreIds = 0;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const result = await runIteration(
        storeModel,
        cakeModel,
        size,
        storePool,
        seededCakes,
        mode,
      );
      aiDurations.push(result.aiMs);
      storeHydrationDurations.push(result.hydrationMs);
      totalDurations.push(result.totalMs);
      storeCalls += result.storeCalls;
      uniqueStoreIds = result.uniqueStoreIds;
    }

    return {
      scenario: `${mode}-dup-${duplication}-size-${size}`,
      iterations,
      warmupIterations,
      cakeResultSize: size,
      uniqueStoreIds,
      storeCalls,
      mode,
      duplication,
      total: toPercentiles(totalDurations),
      ai: toPercentiles(aiDurations),
      storeHydration: toPercentiles(storeHydrationDurations),
    };
  } finally {
    await cakeModel.deleteMany({ cursor: BASELINE_CAKE_CURSOR });
  }
}

function printResults(results: ScenarioResult[]): void {
  console.log(
    [
      '| scenario | mode | duplication | iterations | warmup | cake result size | unique store ids | store calls | total p50 | total p95 | total p99 | ai p95 | store hydration p95 | store hydration p99 |',
      '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
      ...results.map((result) =>
        [
          `| ${result.scenario}`,
          result.mode,
          result.duplication,
          result.iterations,
          result.warmupIterations,
          result.cakeResultSize,
          result.uniqueStoreIds,
          result.storeCalls,
          formatMs(result.total.p50),
          formatMs(result.total.p95),
          formatMs(result.total.p99),
          formatMs(result.ai.p95),
          formatMs(result.storeHydration.p95),
          `${formatMs(result.storeHydration.p99)} |`,
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

  const storeCount = getEnvNumber('BASELINE_STORE_COUNT', DEFAULT_STORE_COUNT);
  const iterations = getEnvNumber('BASELINE_ITERATIONS', DEFAULT_ITERATIONS);
  const warmupIterations = getEnvNumber(
    'BASELINE_WARMUP',
    DEFAULT_WARMUP_ITERATIONS,
  );
  const sizes = getScenarioSizes();
  const mode = getBaselineMode();
  const duplications = getBaselineDuplications();

  const debug = isDebugEnabled();

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
  const storeModel = connection.model(Store.name, StoreSchema);
  const cakeModel = connection.model(Cake.name, CakeSchema);

  if (debug) {
    const client = connection.getClient();
    client.on('commandStarted', (event) => {
      console.log(`[cmd] ${event.commandName}`, JSON.stringify(event.command));
    });
    client.on('commandSucceeded', (event) => {
      console.log(`[cmd-ok] ${event.commandName} ${event.duration}ms`);
    });
    client.on('commandFailed', (event) => {
      console.log(
        `[cmd-err] ${event.commandName} ${event.duration}ms`,
        event.failure?.message ?? '',
      );
    });
  }

  try {
    const seededStoreIds = await seedStores(storeModel, storeCount);
    const results: ScenarioResult[] = [];

    for (const duplication of duplications) {
      for (const size of sizes) {
        results.push(
          await measureScenario(
            storeModel,
            cakeModel,
            size,
            iterations,
            warmupIterations,
            seededStoreIds,
            mode,
            duplication,
          ),
        );
      }
    }

    printResults(results);
  } finally {
    await cakeModel.deleteMany({ cursor: BASELINE_CAKE_CURSOR });
    await storeModel.deleteMany({ owner_user_id: BASELINE_OWNER_USER_ID });
    await connection.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
