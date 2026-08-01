import { SearchService } from './search.service';

describe('SearchService getRank', () => {
  function createService(options?: {
    searchResult?: Record<string, unknown>;
    latest?: Array<{ searchWord?: string }>;
  }) {
    const clipClient = {
      koSearchPage: jest.fn().mockResolvedValue(
        options?.searchResult ?? {
          result: [],
          nextPage: 1,
          isLastPage: false,
        },
      ),
    };
    const logService = {
      searchlog: jest.fn().mockResolvedValue(undefined),
      getRankWord: jest.fn().mockResolvedValue([{ _id: 'realtime', count: 1 }]),
      getLatestWord: jest.fn().mockResolvedValue(options?.latest ?? []),
    };
    const keywordRankService = {
      getRanked: jest.fn().mockResolvedValue({
        ranking: [{ _id: 'precomputed', count: 2 }],
        startDate: '2026-06-04',
        endDate: '2026-07-04',
      }),
    };
    const service = new SearchService(
      clipClient as never,
      logService as never,
      keywordRankService as never,
    );
    return { service, clipClient, logService, keywordRankService };
  }

  it('does not search or record an empty keyword', async () => {
    const { service, clipClient, logService } = createService();

    await expect(service.search('', 0, 'user-1')).resolves.toEqual({
      cakes: [],
      hasMore: false,
    });
    expect(clipClient.koSearchPage).not.toHaveBeenCalled();
    expect(logService.searchlog).not.toHaveBeenCalled();
  });

  it('records each comma keyword on the first page with its related words', async () => {
    const { service, logService } = createService();

    await service.search('chocolate, birthday, cream', 0, 'user-1');

    expect(logService.searchlog.mock.calls).toEqual([
      ['user-1', 'chocolate', ['birthday', 'cream']],
      ['user-1', 'birthday', ['chocolate', 'cream']],
      ['user-1', 'cream', ['chocolate', 'birthday']],
    ]);
  });

  it('does not record search events after the first page', async () => {
    const { service, logService } = createService();

    await service.search('chocolate,birthday', 1, 'user-1');

    expect(logService.searchlog).not.toHaveBeenCalled();
  });

  it('serves the default path from the read model without aggregation', async () => {
    const { service, logService, keywordRankService } = createService();

    const result = await service.getRank(undefined, undefined, 4, 400);

    expect(keywordRankService.getRanked).toHaveBeenCalledWith(4, 400);
    expect(logService.getRankWord).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ranking: [{ id: 'precomputed', count: 2 }],
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
      ranking: [{ id: 'realtime', count: 1 }],
      startDate: '2024-01-01',
      endDate: '2024-02-01',
    });
  });

  it('returns an empty latest-search view when the user has no history', async () => {
    const { service, logService } = createService();

    await expect(service.getLatest('user-1')).resolves.toEqual({
      keywords: [],
    });
    expect(logService.getLatestWord).toHaveBeenCalledWith('user-1');
  });

  it('keeps recent search order while removing duplicates within the ten-row source limit', async () => {
    const { service } = createService({
      latest: [
        { searchWord: 'cream' },
        { searchWord: 'birthday' },
        { searchWord: 'cream' },
        { searchWord: '' },
        { searchWord: 'chocolate' },
      ],
    });

    await expect(service.getLatest('user-1')).resolves.toEqual({
      keywords: ['cream', 'birthday', 'chocolate'],
    });
  });
});
