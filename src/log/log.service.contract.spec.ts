import mongoose from 'mongoose';
import fixtures from '../../test/fixtures/log-upload-baseline.contract.json';
import { CakeLikeLog, CakeLikeLogSchema } from './entities/cakeLikeLog.shema';
import { KeywordLog, KeywordLogSchema } from './entities/keywordLog.shema';
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
    const latestQuery = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };
    const keywordAggregate = aggregateResult([]);
    const cakeAggregate = aggregateResult([]);
    const keywordModel = {
      create: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockReturnValue(latestQuery),
      aggregate: jest.fn().mockReturnValue(keywordAggregate),
    };
    const cakeLikeModel = {
      create: jest.fn().mockResolvedValue(undefined),
      aggregate: jest.fn().mockReturnValue(cakeAggregate),
    };
    const service = new LogService(
      keywordModel as never,
      cakeLikeModel as never,
    );
    return {
      service,
      keywordModel,
      cakeLikeModel,
      latestQuery,
      keywordAggregate,
      cakeAggregate,
    };
  }

  it('keeps legacy event and read-model collection names', () => {
    const isolated = new mongoose.Mongoose();
    const models = {
      searchEvents: isolated.model(KeywordLog.name, KeywordLogSchema),
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
    ).toEqual(fixtures.collections);
  });

  it('records the legacy search and cake-like event document shapes', async () => {
    const { service, keywordModel, cakeLikeModel } = createService();

    await service.searchlog('user-1', 'birthday', ['cream', 'chocolate']);
    await service.cakeLikelog('user-1', '65a000000000000000000001', true);

    expect(keywordModel.create).toHaveBeenCalledWith({
      userId: 'user-1',
      searchWord: 'birthday',
      relatedWord: ['cream', 'chocolate'],
    });
    expect(cakeLikeModel.create).toHaveBeenCalledWith({
      userId: 'user-1',
      cakeId: expect.any(mongoose.Types.ObjectId),
      type: true,
    });
  });

  it('queries recent searches newest-first with a ten-row source limit', async () => {
    const { service, keywordModel, latestQuery } = createService();

    await service.getLatestWord('user-1');

    expect(keywordModel.find).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(latestQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(latestQuery.limit).toHaveBeenCalledWith(10);
  });

  it('keeps keyword rank window, count sort, limit, and maxTimeMS', async () => {
    const { service, keywordModel, keywordAggregate } = createService();

    await service.getRankWord('2026-01-01', '2026-01-31', 4, 400);

    expect(keywordModel.aggregate).toHaveBeenCalledWith([
      {
        $match: {
          createdAt: {
            $gte: new Date('2026-01-01'),
            $lte: new Date('2026-01-31'),
          },
        },
      },
      { $group: { _id: '$searchWord', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]);
    expect(keywordAggregate.limit).toHaveBeenCalledWith(4);
    expect(keywordAggregate.option).toHaveBeenCalledWith({ maxTimeMS: 400 });
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
