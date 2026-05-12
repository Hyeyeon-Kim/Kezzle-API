import mongoose from 'mongoose';
import { Store, StoreSchema } from '../../src/store/entities/store.schema';

async function main() {
  const connection = await mongoose.createConnection(process.env.MONGODB_URL, {
    dbName: process.env.MONGODB_DBNAME_MAIN,
  });
  const storeModel = connection.model(Store.name, StoreSchema);

  await storeModel.deleteMany({ owner_user_id: 'kan-17-explain' });
  const stores = await storeModel.insertMany(
    Array.from({ length: 10 }, (_, i) => ({
      name: `Explain Store ${i + 1}`,
      address: `addr ${i + 1}`,
      owner_user_id: 'kan-17-explain',
      taste: ['vanilla'],
      location: { type: 'Point', coordinates: [127, 37] },
      user_like_ids: [],
      detail_images: [],
      operating_time: [],
    })),
  );
  const ids = stores.map((s) => s._id);

  const explain = await storeModel
    .find({ _id: { $in: ids } })
    .explain('executionStats');

  console.log(JSON.stringify(explain, null, 2));

  await storeModel.deleteMany({ owner_user_id: 'kan-17-explain' });
  await connection.close();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
