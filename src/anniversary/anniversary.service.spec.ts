import { of } from 'rxjs';
import { AnniversaryService } from './anniversary.service';

describe('AnniversaryService', () => {
  it('passes AbortSignal to Axios and maxTimeMS to MongoDB', async () => {
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
    const httpService = {
      get: jest.fn(() =>
        of({
          data: {
            result: [],
          },
        }),
      ),
    };
    const homeMetrics = {
      countDb: jest.fn(),
      countAi: jest.fn(),
      countAiError: jest.fn(),
    };
    const homeCache = {
      getWithSwr: jest.fn(({ refresh }) => refresh()),
    };
    const service = new AnniversaryService(
      anniversaryModel as never,
      httpService as never,
      homeMetrics as never,
      homeCache as never,
    );
    const controller = new AbortController();

    await service.getAnniversary(controller.signal, 250);

    expect(query.maxTimeMS).toHaveBeenCalledWith(250);
    expect(httpService.get).toHaveBeenCalledWith(expect.any(String), {
      signal: controller.signal,
    });
    expect(homeCache.getWithSwr).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'home:anniversary' }),
    );
  });
});
