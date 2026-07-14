import { AnniversaryService } from './anniversary.service';

describe('AnniversaryService', () => {
  it('passes AbortSignal to ClipClient and maxTimeMS to MongoDB', async () => {
    const anniversary = {
      id: 'anniversary-id',
      name: '기념일',
      ment: '기념일 케이크',
      keyword: ['기념일'],
      date: new Date(),
    };
    const query = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maxTimeMS: jest.fn().mockReturnThis(),
      then: (
        resolve: (value: (typeof anniversary)[]) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve([anniversary]).then(resolve, reject),
    };
    const anniversaryModel = {
      find: jest.fn(() => query),
    };
    const clipClient = {
      koSearch: jest.fn().mockResolvedValue([]),
    };
    const service = new AnniversaryService(
      anniversaryModel as never,
      clipClient as never,
    );
    const controller = new AbortController();

    await service.getAnniversary(controller.signal, 250);

    expect(query.maxTimeMS).toHaveBeenCalledWith(250);
    expect(clipClient.koSearch).toHaveBeenCalledWith(
      '기념일',
      6,
      controller.signal,
    );
  });
});
