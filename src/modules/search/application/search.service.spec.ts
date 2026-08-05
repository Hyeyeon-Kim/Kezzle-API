import { SearchService } from './search.service';
import { Logger } from '@nestjs/common';

describe('SearchService', () => {
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
    const searchEventRecorder = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const searchHistoryReader = {
      findLatest: jest.fn().mockResolvedValue(options?.latest ?? []),
    };
    const metricsService = {
      countRecordFailure: jest.fn(),
    };
    const service = new SearchService(
      clipClient as never,
      searchEventRecorder as never,
      searchHistoryReader as never,
      metricsService as never,
    );
    return {
      service,
      clipClient,
      searchEventRecorder,
      searchHistoryReader,
      metricsService,
    };
  }

  it('does not search or record an empty keyword', async () => {
    const { service, clipClient, searchEventRecorder } = createService();

    await expect(service.search('', 0, 'user-1')).resolves.toEqual({
      cakes: [],
      hasMore: false,
    });
    expect(clipClient.koSearchPage).not.toHaveBeenCalled();
    expect(searchEventRecorder.record).not.toHaveBeenCalled();
  });

  it('records each comma keyword on the first page with its related words', async () => {
    const { service, searchEventRecorder } = createService();

    await service.search('chocolate, birthday, cream', 0, 'user-1');

    expect(searchEventRecorder.record.mock.calls).toEqual([
      ['user-1', 'chocolate', ['birthday', 'cream']],
      ['user-1', 'birthday', ['chocolate', 'cream']],
      ['user-1', 'cream', ['chocolate', 'birthday']],
    ]);
  });

  it('does not record search events after the first page', async () => {
    const { service, searchEventRecorder } = createService();

    await service.search('chocolate,birthday', 1, 'user-1');

    expect(searchEventRecorder.record).not.toHaveBeenCalled();
  });

  it('returns an empty latest-search view when the user has no history', async () => {
    const { service, searchHistoryReader } = createService();

    await expect(service.getLatest('user-1')).resolves.toEqual({
      keywords: [],
    });
    expect(searchHistoryReader.findLatest).toHaveBeenCalledWith('user-1');
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

  it('keeps search success and records a metric and log when event persistence fails', async () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { service, searchEventRecorder, metricsService } = createService();
    searchEventRecorder.record.mockRejectedValue(
      new Error('event create failed'),
    );

    await expect(
      service.search('birthday', 0, 'user-1'),
    ).resolves.toMatchObject({
      cakes: [],
      hasMore: true,
    });
    await new Promise(setImmediate);

    expect(metricsService.countRecordFailure).toHaveBeenCalledTimes(1);
    expect(logger).toHaveBeenCalledWith({
      event: 'search_event_record_failed',
      error: 'event create failed',
    });
    logger.mockRestore();
  });
});
