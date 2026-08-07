import { CurationService } from './curation.service';

describe('CurationService', () => {
  function createService() {
    const curationRepository = {
      findByIdOrThrow: jest.fn().mockResolvedValue({
        id: 'cur-1',
        key: 'birthday',
        description: 'birthday cakes',
      }),
      create: jest.fn().mockResolvedValue({ _id: 'cur-1' }),
      updateCakes: jest.fn().mockResolvedValue(undefined),
    };
    const clipClient = {
      koSearch: jest.fn().mockResolvedValue([{ _id: 'clip-cake' }]),
      koSearchPage: jest.fn().mockResolvedValue({ result: [] }),
    };

    return {
      service: new CurationService(
        curationRepository as never,
        clipClient as never,
      ),
      curationRepository,
      clipClient,
    };
  }

  it('bumps the curation via updateOne even when content is unchanged', async () => {
    const { service, curationRepository } = createService();

    await service.updateCuration('cur-1');

    expect(curationRepository.updateCakes).toHaveBeenCalledWith('cur-1', [
      expect.objectContaining({
        id: 'clip-cake',
        tags: [],
        likedUserIds: [],
      }),
    ]);
  });

  it('contains no Home orchestration entry point', () => {
    const { service } = createService();

    expect(service).not.toHaveProperty('homeCuration');
    expect(service).not.toHaveProperty('homeCurationV2');
  });
});
