import { CurationService } from './curation.service';

describe('CurationService', () => {
  function createService() {
    const curationModel = {
      findById: jest.fn().mockResolvedValue({
        _id: 'cur-1',
        key: 'birthday',
        description: 'birthday cakes',
      }),
      create: jest.fn().mockResolvedValue({ _id: 'cur-1' }),
      updateOne: jest.fn().mockResolvedValue(undefined),
    };
    const clipClient = {
      koSearch: jest.fn().mockResolvedValue([{ _id: 'clip-cake' }]),
      koSearchPage: jest.fn().mockResolvedValue({ result: [] }),
    };

    return {
      service: new CurationService(
        curationModel as never,
        clipClient as never,
      ),
      curationModel,
      clipClient,
    };
  }

  it('bumps the curation via updateOne even when content is unchanged', async () => {
    const { service, curationModel } = createService();

    await service.updateCuration('cur-1');

    expect(curationModel.updateOne).toHaveBeenCalledWith(
      { _id: 'cur-1' },
      { $set: { cakes: [{ _id: 'clip-cake' }] } },
    );
  });

  it('contains no Home orchestration entry point', () => {
    const { service } = createService();

    expect(service).not.toHaveProperty('homeCuration');
    expect(service).not.toHaveProperty('homeCurationV2');
  });
});
