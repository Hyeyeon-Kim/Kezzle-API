import { AnniversaryService } from './anniversary.service';

describe('AnniversaryService', () => {
  it('separates Mongo lookup from the CLIP recommendation call', async () => {
    const anniversary = {
      id: 'anniversary-id',
      name: '기념일',
      ment: '기념일 케이크',
      keyword: ['기념일'],
      date: new Date(),
    };
    const anniversaryRepository = {
      findNext: jest.fn().mockResolvedValue(anniversary),
    };
    const clipClient = {
      koSearch: jest.fn().mockResolvedValue([]),
    };
    const service = new AnniversaryService(
      anniversaryRepository as never,
      clipClient as never,
    );
    const controller = new AbortController();

    const source = await service.findNextAnniversary(250);
    await service.getAnniversaryRecommendations(source, controller.signal);

    expect(anniversaryRepository.findNext).toHaveBeenCalledWith(250);
    expect(clipClient.koSearch).toHaveBeenCalledWith(
      '기념일',
      6,
      controller.signal,
    );
  });
});
