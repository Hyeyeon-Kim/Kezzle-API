import mongoose from 'mongoose';
import fixtures from '../../../../test/fixtures/log-upload-baseline.contract.json';
import { SearchEventRepository } from './search-event.repository';
import { KeywordLog, KeywordLogSchema } from './search-event.schema';

function aggregateResult<T>(result: T[]) {
  const aggregate = Promise.resolve(result) as Promise<T[]> & {
    limit: jest.Mock;
    option: jest.Mock;
  };
  aggregate.limit = jest.fn().mockReturnValue(aggregate);
  aggregate.option = jest.fn().mockReturnValue(aggregate);
  return aggregate;
}

describe('SearchEventRepository contract', () => {
  function createRepository() {
    const latestQuery = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    const keywordAggregate = aggregateResult([]);
    const keywordModel = {
      create: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockReturnValue(latestQuery),
      aggregate: jest.fn().mockReturnValue(keywordAggregate),
    };
    const repository = new SearchEventRepository(keywordModel as never);
    return { repository, keywordModel, latestQuery, keywordAggregate };
  }

  it('keeps the explicit legacy keywordlogs collection name', () => {
    const isolated = new mongoose.Mongoose();
    const model = isolated.model(KeywordLog.name, KeywordLogSchema);

    expect(model.collection.collectionName).toBe(
      fixtures.collections.searchEvents,
    );
  });

  it('records the legacy search event document shape', async () => {
    const { repository, keywordModel } = createRepository();

    await repository.record('user-1', 'birthday', ['cream', 'chocolate']);

    expect(keywordModel.create).toHaveBeenCalledWith({
      userId: 'user-1',
      searchWord: 'birthday',
      relatedWord: ['cream', 'chocolate'],
    });
  });

  it('queries recent searches newest-first with a ten-row source limit', async () => {
    const { repository, keywordModel, latestQuery } = createRepository();

    await repository.findLatest('user-1');

    expect(keywordModel.find).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(latestQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(latestQuery.limit).toHaveBeenCalledWith(10);
    expect(latestQuery.lean).toHaveBeenCalledTimes(1);
  });

  it('keeps keyword rank window, count sort, limit, and maxTimeMS', async () => {
    const { repository, keywordModel, keywordAggregate } = createRepository();

    await repository.getRanked('2026-01-01', '2026-01-31', 4, 400);

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
});
