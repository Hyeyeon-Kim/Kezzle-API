import mongoose from 'mongoose';
import fixtures from '../../../../../test/fixtures/log-upload-baseline.contract.json';
import { SearchEventRepository } from './search-event.repository';
import { KeywordLog, KeywordLogSchema } from './search-event.schema';

describe('SearchEventRepository contract', () => {
  function createRepository() {
    const latestQuery = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    const keywordModel = {
      create: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockReturnValue(latestQuery),
    };
    const repository = new SearchEventRepository(keywordModel as never);
    return { repository, keywordModel, latestQuery };
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
});
