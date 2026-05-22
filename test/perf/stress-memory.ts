import mongoose from 'mongoose';
import { Store, StoreSchema } from '../../src/store/entities/store.schema';
import { StoreSimpleResponseDto } from '../../src/store/dto/response-simple-store.dto';
import { CakeSimilarResponseDto } from '../../src/cake/dto/response-similar-cake.dto';

const STRESS_OWNER_USER_ID = 'kan-21-stress-memory';
const STRESS_SIZE = 1000;
const STRESS_STORE_COUNT = 1000;

type MockCake = {
  id: string;
  image: { s3Url: string };
  owner_store_id: string;
  cursor: string;
  tag_ins: string[];
  user_like_ids: string[];
  score: number;
};

function heapUsedKb(): number {
  return process.memoryUsage().heapUsed / 1024;
}

async function main(): Promise<void> {
  const mongoUrl = process.env.MONGODB_URL;

  if (!mongoUrl) {
    throw new Error('MONGODB_URL is required');
  }

  const connection = await mongoose.createConnection(mongoUrl, {
    dbName: process.env.MONGODB_DBNAME_MAIN,
  });
  const storeModel = connection.model(Store.name, StoreSchema);

  try {
    await storeModel.deleteMany({ owner_user_id: STRESS_OWNER_USER_ID });
    const stores = await storeModel.insertMany(
      Array.from({ length: STRESS_STORE_COUNT }, (_, i) => ({
        name: `Stress Store ${i + 1}`,
        address: `Stress addr ${i + 1}`,
        owner_user_id: STRESS_OWNER_USER_ID,
        taste: ['vanilla', 'choco'],
        location: { type: 'Point', coordinates: [127, 37] },
        user_like_ids: [],
        detail_images: [],
        operating_time: [],
      })),
    );
    const storeIds = stores.map((s) => s._id.toString());

    if (typeof global.gc === 'function') {
      global.gc();
    }

    const before = heapUsedKb();

    const cakes: MockCake[] = Array.from({ length: STRESS_SIZE }, (_, i) => ({
      id: `stress-cake-${i + 1}`,
      image: { s3Url: `https://example.com/stress-cake-${i + 1}.jpg` },
      owner_store_id: storeIds[i % storeIds.length],
      cursor: `stress-cursor-${i + 1}`,
      tag_ins: ['baseline'],
      user_like_ids: [],
      score: i / 100,
    }));

    const afterMock = heapUsedKb();

    const targetIds = [...new Set(cakes.map((c) => c.owner_store_id))];
    const hydrationStores = await storeModel.find({ _id: { $in: targetIds } });
    const storeMap = new Map(hydrationStores.map((s) => [s._id.toString(), s]));

    const afterStoreMap = heapUsedKb();

    const responses = cakes.map(
      (cake) =>
        new CakeSimilarResponseDto(
          cake,
          new StoreSimpleResponseDto(storeMap.get(cake.owner_store_id)),
        ),
    );

    const afterResponses = heapUsedKb();

    const responseJson = JSON.stringify(responses);
    const cakesJson = JSON.stringify(cakes);
    const inIds = JSON.stringify(targetIds);

    const afterSerialize = heapUsedKb();

    console.log(
      [
        `size: ${STRESS_SIZE}`,
        `store_count: ${STRESS_STORE_COUNT}`,
        `unique_store_ids_in_$in: ${targetIds.length}`,
        `--- heap delta (KB) ---`,
        `mock cakes:         ${(afterMock - before).toFixed(1)}`,
        `+ storeMap (find):  ${(afterStoreMap - afterMock).toFixed(1)}`,
        `+ response DTOs:    ${(afterResponses - afterStoreMap).toFixed(1)}`,
        `+ serialize JSON:   ${(afterSerialize - afterResponses).toFixed(1)}`,
        `total since before: ${(afterSerialize - before).toFixed(1)}`,
        `--- payload sizes (bytes) ---`,
        `cakes JSON:         ${cakesJson.length}`,
        `$in payload (ObjectId list JSON): ${inIds.length}`,
        `response JSON:      ${responseJson.length}`,
        `bson 16MB headroom: ${((16 * 1024 * 1024) / inIds.length).toFixed(
          0,
        )}x ($in payload 기준)`,
      ].join('\n'),
    );
  } finally {
    await storeModel.deleteMany({ owner_user_id: STRESS_OWNER_USER_ID });
    await connection.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
