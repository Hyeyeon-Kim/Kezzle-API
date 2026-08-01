import mongoose from 'mongoose';
import fixtures from '../../../../test/fixtures/log-upload-baseline.contract.json';
import { CakeLikeEventRepository } from './cake-like-event.repository';
import { CakeLikeLog, CakeLikeLogSchema } from './cake-like-event.schema';

function aggregateResult<T>(result: T[]) {
  const aggregate = Promise.resolve(result) as Promise<T[]> & {
    option: jest.Mock;
  };
  aggregate.option = jest.fn().mockReturnValue(aggregate);
  return aggregate;
}

describe('CakeLikeEventRepository contract', () => {
  function createRepository() {
    const aggregate = aggregateResult([
      {
        _id: new mongoose.Types.ObjectId('65a000000000000000000001'),
        app_like: 2,
      },
    ]);
    const model = {
      create: jest.fn().mockResolvedValue(undefined),
      aggregate: jest.fn().mockReturnValue(aggregate),
    };
    return {
      repository: new CakeLikeEventRepository(model as never),
      model,
      aggregate,
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

  it('aggregates true/false events into a net count with window and maxTimeMS', async () => {
    const { repository, model, aggregate } = createRepository();

    const result = await repository.getNetCounts(
      '2026-01-01',
      '2026-01-31',
      400,
    );

    expect(model.aggregate).toHaveBeenCalledWith([
      {
        $match: {
          createdAt: {
            $gte: new Date('2026-01-01'),
            $lte: new Date('2026-01-31'),
          },
        },
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
    ]);
    expect(aggregate.option).toHaveBeenCalledWith({ maxTimeMS: 400 });
    expect(result).toEqual([
      { cakeId: '65a000000000000000000001', appLike: 2 },
    ]);
  });
});
