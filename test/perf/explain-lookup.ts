import mongoose from 'mongoose';
import { Store, StoreSchema } from '../../src/store/entities/store.schema';
import { Cake, CakeSchema } from '../../src/cake/entities/cake.schema';

async function main() {
  const connection = await mongoose.createConnection(process.env.MONGODB_URL, {
    dbName: process.env.MONGODB_DBNAME_MAIN,
  });
  const storeModel = connection.model(Store.name, StoreSchema);
  const cakeModel = connection.model(Cake.name, CakeSchema);

  await cakeModel.deleteMany({ cursor: 'kan-19-explain' });
  await storeModel.deleteMany({ owner_user_id: 'kan-19-explain' });

  const stores = await storeModel.insertMany(
    Array.from({ length: 10 }, (_, i) => ({
      name: `Explain Store ${i + 1}`,
      address: `addr ${i + 1}`,
      owner_user_id: 'kan-19-explain',
      taste: ['vanilla'],
      location: { type: 'Point', coordinates: [127, 37] },
      user_like_ids: [],
      detail_images: [],
      operating_time: [],
    })),
  );

  const faissIdBase = Date.now() * 1000;
  const cakes = await cakeModel.insertMany(
    Array.from({ length: 10 }, (_, i) => ({
      image: { s3Url: `https://example.com/explain-${i + 1}.jpg` },
      owner_store_id: stores[i]._id.toString(),
      cursor: 'kan-19-explain',
      tag_ins: ['baseline'],
      user_like_ids: [],
      is_delete: false,
      faiss_id: faissIdBase + i,
    })),
  );

  const explain = await cakeModel
    .aggregate([
      { $match: { _id: { $in: cakes.map((c) => c._id) } } },
      {
        $lookup: {
          from: 'stores',
          let: { storeId: { $toObjectId: '$owner_store_id' } },
          pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$storeId'] } } }],
          as: 'store',
        },
      },
      { $unwind: '$store' },
    ])
    .explain('executionStats');

  console.log(JSON.stringify(explain, null, 2));

  await cakeModel.deleteMany({ cursor: 'kan-19-explain' });
  await storeModel.deleteMany({ owner_user_id: 'kan-19-explain' });
  await connection.close();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
