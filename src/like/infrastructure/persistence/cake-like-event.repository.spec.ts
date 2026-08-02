import mongoose from 'mongoose';
import fixtures from '../../../../test/fixtures/log-upload-baseline.contract.json';
import { CakeLikeEventRepository } from './cake-like-event.repository';
import { CakeLikeLog, CakeLikeLogSchema } from './cake-like-event.schema';

describe('CakeLikeEventRepository contract', () => {
  function createRepository() {
    const model = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    return {
      repository: new CakeLikeEventRepository(model as never),
      model,
    };
  }

  it('keeps the explicit legacy cakelikelogs collection name', () => {
    const isolated = new mongoose.Mongoose();
    const model = isolated.model(CakeLikeLog.name, CakeLikeLogSchema);

    expect(model.collection.collectionName).toBe(
      fixtures.collections.cakeLikeEvents,
    );
  });

  it('records the legacy cake-like event document shape', async () => {
    const { repository, model } = createRepository();

    await repository.record('user-1', '65a000000000000000000001', true);

    expect(model.create).toHaveBeenCalledWith({
      userId: 'user-1',
      cakeId: expect.any(mongoose.Types.ObjectId),
      type: true,
    });
  });
});
