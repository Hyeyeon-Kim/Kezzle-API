import { SearchService } from './search.service';

describe('SearchService getRank', () => {
  function createService() {
    const logService = {
      getRankWord: jest.fn().mockResolvedValue([{ _id: 'realtime', count: 1 }]),
    };
    const keywordRankService = {
      getRanked: jest.fn().mockResolvedValue({
        ranking: [{ _id: 'precomputed', count: 2 }],
        startDate: '2026-06-04',
        endDate: '2026-07-04',
      }),
    };
    const homeMetrics = {
      countDb: jest.fn(),
      countAi: jest.fn(),
      countAiError: jest.fn(),
    };
    const service = new SearchService(
      {} as never,
      logService as never,
      keywordRankService as never,
      homeMetrics as never,
    );
    return { service, logService, keywordRankService };
  }

  it('serves the default path from the read model without aggregation', async () => {
    const { service, logService, keywordRankService } = createService();

    const result = await service.getRank(undefined, undefined, 4, 400);

    expect(keywordRankService.getRanked).toHaveBeenCalledWith(4, 400);
    expect(logService.getRankWord).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ranking: [{ _id: 'precomputed', count: 2 }],
      startDate: '2026-06-04',
      endDate: '2026-07-04',
    });
  });

  it('keeps the realtime aggregation for explicit date ranges', async () => {
    const { service, logService, keywordRankService } = createService();

    const result = await service.getRank('2024-01-01', '2024-02-01');

    expect(logService.getRankWord).toHaveBeenCalledWith(
      '2024-01-01',
      '2024-02-01',
      undefined,
      undefined,
    );
    expect(keywordRankService.getRanked).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ranking: [{ _id: 'realtime', count: 1 }],
      startDate: '2024-01-01',
      endDate: '2024-02-01',
    });
  });
});
