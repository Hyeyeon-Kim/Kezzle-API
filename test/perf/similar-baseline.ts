import mongoose from 'mongoose';
import { Store, StoreSchema } from '../../src/store/entities/store.schema';
import { StoreSimpleResponseDto } from '../../src/store/dto/response-simple-store.dto';
import { CakeSimilarResponseDto } from '../../src/cake/dto/response-similar-cake.dto';

type ScenarioResult = {
  scenario: string;
  iterations: number;
  cakeResultSize: number;
  uniqueStoreIds: number;
  storeCalls: number;
  mode: BaselineMode;
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

type BaselineMode = 'current' | 'batch';

const DEFAULT_STORE_COUNT = 200;
const DEFAULT_ITERATIONS = 100;
const DEFAULT_SIZES = [10, 20, 50];
const BASELINE_OWNER_USER_ID = 'kan-16-baseline-user';

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
  return process.env.BASELINE_MODE === 'batch' ? 'batch' : 'current';
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

async function measureScenario(
  storeModel: mongoose.Model<Store>,
  size: number,
  iterations: number,
  storeIds: string[],
  mode: BaselineMode,
): Promise<ScenarioResult> {
  const totalDurations: number[] = [];
  const aiDurations: number[] = [];
  const storeHydrationDurations: number[] = [];
  let storeCalls = 0;
  let uniqueStoreIds = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const totalStart = process.hrtime.bigint();

    const aiStart = process.hrtime.bigint();
    const cakes = generateMockCakes(size, storeIds);
    aiDurations.push(elapsedMs(aiStart));

    uniqueStoreIds = new Set(cakes.map((cake) => cake.owner_store_id)).size;

    const storeHydrationStart = process.hrtime.bigint();
    let responses: CakeSimilarResponseDto[];

    if (mode === 'batch') {
      const targetStoreIds = [
        ...new Set(cakes.map((cake) => cake.owner_store_id).filter(Boolean)),
      ];
      storeCalls += 1;
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
    } else {
      responses = await Promise.all(
        cakes.map(async (cake) => {
          storeCalls += 1;
          const store = await storeModel.findById(cake.owner_store_id);

          return new CakeSimilarResponseDto(
            cake,
            new StoreSimpleResponseDto(store),
          );
        }),
      );
    }

    storeHydrationDurations.push(elapsedMs(storeHydrationStart));

    if (responses.length !== size) {
      throw new Error(
        `Unexpected response length. expected=${size}, actual=${responses.length}`,
      );
    }

    totalDurations.push(elapsedMs(totalStart));
  }

  return {
    scenario: `${mode}-size-${size}`,
    iterations,
    cakeResultSize: size,
    uniqueStoreIds,
    storeCalls,
    mode,
    total: toPercentiles(totalDurations),
    ai: toPercentiles(aiDurations),
    storeHydration: toPercentiles(storeHydrationDurations),
  };
}

function printResults(results: ScenarioResult[]): void {
  console.log(
    [
      '| scenario | iterations | cake result size | unique store ids | store calls | total p50 | total p95 | total p99 | ai p95 | store hydration p95 | store hydration p99 |',
      '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
      ...results.map((result) =>
        [
          `| ${result.scenario}`,
          result.iterations,
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
  const sizes = getScenarioSizes();
  const mode = getBaselineMode();

  if (isDebugEnabled()) {
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
  });
  const storeModel = connection.model(Store.name, StoreSchema);

  try {
    const seededStoreIds = await seedStores(storeModel, storeCount);
    const results: ScenarioResult[] = [];

    for (const size of sizes) {
      results.push(
        await measureScenario(
          storeModel,
          size,
          iterations,
          seededStoreIds,
          mode,
        ),
      );
    }

    printResults(results);
  } finally {
    await storeModel.deleteMany({ owner_user_id: BASELINE_OWNER_USER_ID });
    await connection.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
