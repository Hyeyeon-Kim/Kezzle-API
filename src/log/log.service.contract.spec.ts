import mongoose from 'mongoose';
import fixtures from '../../test/fixtures/log-upload-baseline.contract.json';
import { CakeLikeLog, CakeLikeLogSchema } from './entities/cakeLikeLog.shema';
import { KeywordRank, KeywordRankSchema } from './entities/keywordRank.shema';
import {
  PopularCakeRank,
  PopularCakeRankSchema,
} from './entities/popularCakeRank.shema';
import { LogService } from './log.service';

function aggregateResult<T>(result: T[]) {
  const aggregate = Promise.resolve(result) as Promise<T[]> & {
    limit: jest.Mock;
    option: jest.Mock;
  };
  aggregate.limit = jest.fn().mockReturnValue(aggregate);
  aggregate.option = jest.fn().mockReturnValue(aggregate);
  return aggregate;
}

describe('LogService Phase A contract', () => {
  function createService() {
    const cakeAggregate = aggregateResult([]);
    const cakeLikeModel = {
      create: jest.fn().mockResolvedValue(undefined),
      aggregate: jest.fn().mockReturnValue(cakeAggregate),
    };
    const service = new LogService(cakeLikeModel as never);
    return {
      service,
      cakeLikeModel,
      cakeAggregate,
    };
  }

  it('keeps legacy event and read-model collection names', () => {
    const isolated = new mongoose.Mongoose();
    const models = {
      cakeLikeEvents: isolated.model(CakeLikeLog.name, CakeLikeLogSchema),
      keywordRanks: isolated.model(KeywordRank.name, KeywordRankSchema),
      popularCakeRanks: isolated.model(
        PopularCakeRank.name,
        PopularCakeRankSchema,
      ),
    };

    expect(
      Object.fromEntries(
        Object.entries(models).map(([name, model]) => [
          name,
          model.collection.collectionName,
        ]),
      ),
    ).toEqual({
      cakeLikeEvents: fixtures.collections.cakeLikeEvents,
      keywordRanks: fixtures.collections.keywordRanks,
      popularCakeRanks: fixtures.collections.popularCakeRanks,
    });
  });

  it('records the legacy cake-like event document shape', async () => {
    const { service, cakeLikeModel } = createService();

    await service.cakeLikelog('user-1', '65a000000000000000000001', true);

    expect(cakeLikeModel.create).toHaveBeenCalledWith({
      userId: 'user-1',
      cakeId: expect.any(mongoose.Types.ObjectId),
      type: true,
    });
  });

  it('keeps popular net-like score, deleted filter, tie-break, and after cursor pipeline', async () => {
    const { service, cakeLikeModel, cakeAggregate } = createService();

    await service.getRankCake('2026-01-01', '2026-01-31', 2.9, 5);

    const pipeline = cakeLikeModel.aggregate.mock.calls[0][0];
    expect(pipeline.map((stage) => Object.keys(stage)[0])).toEqual([
      '$match',
      '$group',
      '$addFields',
      '$lookup',
      '$unwind',
      '$match',
      '$project',
      '$addFields',
      '$sort',
      '$match',
    ]);
    expect(pipeline[1]).toEqual({
      $group: {
        _id: '$cakeId',
        trueCount: {
          $sum: { $cond: [{ $eq: ['$type', true] }, 1, 0] },
        },
        falseCount: {
          $sum: { $cond: [{ $eq: ['$type', false] }, 1, 0] },
        },
      },
    });
    expect(pipeline[2]).toEqual({
      $addFields: { app_like: { $subtract: ['$trueCount', '$falseCount'] } },
    });
    expect(pipeline[5]).toEqual({
      $match: { 'cakeInfo.is_delete': { $ne: true } },
    });
    expect(pipeline[7]).toEqual({
      $addFields: {
        total: {
          $add: [
            { $multiply: [{ $toInt: '$like_ins' }, 0.2] },
            { $multiply: ['$app_like', 0.9] },
          ],
        },
      },
    });
    expect(pipeline[8]).toEqual({ $sort: { total: -1, _id: 1 } });
    expect(pipeline[9]).toEqual({ $match: { total: { $lt: 2.9 } } });
    expect(cakeAggregate.limit).toHaveBeenCalledWith(5);
  });
});
