import mongoose from 'mongoose';
import fixtures from '../../test/fixtures/log-upload-baseline.contract.json';
import {
  KeywordRank,
  KeywordRankSchema,
} from './infrastructure/persistence/keyword-rank.schema';
import {
  PopularCakeRank,
  PopularCakeRankSchema,
} from './infrastructure/persistence/popular-cake-rank.schema';

describe('Rank schema Phase A collection contract', () => {
  it('keeps keyword and popular read-model collection names', () => {
    const isolated = new mongoose.Mongoose();
    const models = {
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
      keywordRanks: fixtures.collections.keywordRanks,
      popularCakeRanks: fixtures.collections.popularCakeRanks,
    });
  });
});
