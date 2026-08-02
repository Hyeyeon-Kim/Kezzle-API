import baseline from '../../test/fixtures/log-upload-baseline.contract.json';
import { Roles } from 'src/user/entities/roles.enum';
import { StoreService } from './store.service';

const owner = {
  firebaseUid: 'owner-1',
  roles: [Roles.SELLER],
};

const store = {
  id: 'store-1',
  name: 'Store Name',
  ownerUserId: 'owner-1',
  logo: { s3Url: 'https://cdn.example.com/old-logo.png' },
  detailImages: [
    { s3Url: 'https://cdn.example.com/detail-1.png' },
    { s3Url: 'https://cdn.example.com/detail-2.png' },
  ],
};

const mediaFile = {
  originalName: 'store.png',
  contentType: 'image/png',
  buffer: Buffer.from('image'),
};

function createService(options?: {
  remove?: jest.Mock;
  create?: jest.Mock;
  update?: jest.Mock;
}) {
  const uploadService = {
    remove: options?.remove ?? jest.fn().mockResolvedValue(undefined),
    create:
      options?.create ??
      jest.fn().mockResolvedValue({ s3Url: 'https://cdn.example.com/new.png' }),
  };
  const storeRepository = {
    findByIdOrThrow: jest.fn().mockResolvedValue(store),
    updateOneById:
      options?.update ?? jest.fn().mockResolvedValue({ acknowledged: true }),
  };
  return {
    service: new StoreService(uploadService as never, storeRepository as never),
    uploadService,
    storeRepository,
  };
}

describe('StoreService Phase A media failure contract', () => {
  it('keeps logo replace path and delete -> upload -> persistence order', async () => {
    const { service, uploadService, storeRepository } = createService();

    await service.changeLogo('store-1', owner as never, mediaFile);

    expect(uploadService.remove).toHaveBeenCalledWith(
      baseline.mediaPaths.storeLogo,
      store.logo.s3Url,
    );
    expect(uploadService.create).toHaveBeenCalledWith(
      baseline.mediaPaths.storeLogo,
      mediaFile,
    );
    expect(storeRepository.updateOneById).toHaveBeenCalledWith('store-1', {
      logo: { s3Url: 'https://cdn.example.com/new.png' },
    });
    expect(uploadService.remove.mock.invocationCallOrder[0]).toBeLessThan(
      uploadService.create.mock.invocationCallOrder[0],
    );
    expect(uploadService.create.mock.invocationCallOrder[0]).toBeLessThan(
      storeRepository.updateOneById.mock.invocationCallOrder[0],
    );
  });

  it('stops logo replace when existing-object deletion fails', async () => {
    const failure = new Error('delete existing failed');
    const { service, uploadService, storeRepository } = createService({
      remove: jest.fn().mockRejectedValue(failure),
    });

    await expect(
      service.changeLogo('store-1', owner as never, mediaFile),
    ).rejects.toBe(failure);
    expect(uploadService.create).not.toHaveBeenCalled();
    expect(storeRepository.updateOneById).not.toHaveBeenCalled();
  });

  it('stops logo persistence when new-object upload fails after deletion', async () => {
    const failure = new Error('upload new failed');
    const { service, uploadService, storeRepository } = createService({
      create: jest.fn().mockRejectedValue(failure),
    });

    await expect(
      service.changeLogo('store-1', owner as never, mediaFile),
    ).rejects.toBe(failure);
    expect(uploadService.remove).toHaveBeenCalledTimes(1);
    expect(storeRepository.updateOneById).not.toHaveBeenCalled();
  });

  it('propagates logo persistence failure after delete and upload without compensation', async () => {
    const failure = new Error('persist logo failed');
    const { service, uploadService } = createService({
      update: jest.fn().mockRejectedValue(failure),
    });

    await expect(
      service.changeLogo('store-1', owner as never, mediaFile),
    ).rejects.toBe(failure);
    expect(uploadService.remove).toHaveBeenCalledTimes(1);
    expect(uploadService.create).toHaveBeenCalledTimes(1);
  });

  it('keeps detail upload path and exposes upload/persistence partial failures', async () => {
    const uploadFailure = new Error('detail upload failed');
    const first = createService({
      create: jest.fn().mockRejectedValue(uploadFailure),
    });

    await expect(
      first.service.Imageupload('store-1', owner as never, mediaFile),
    ).rejects.toBe(uploadFailure);
    expect(first.uploadService.create).toHaveBeenCalledWith(
      baseline.mediaPaths.storeDetail,
      mediaFile,
    );
    expect(first.storeRepository.updateOneById).not.toHaveBeenCalled();

    const persistFailure = new Error('detail persistence failed');
    const second = createService({
      update: jest.fn().mockRejectedValue(persistFailure),
    });
    await expect(
      second.service.Imageupload('store-1', owner as never, mediaFile),
    ).rejects.toBe(persistFailure);
    expect(second.uploadService.create).toHaveBeenCalledTimes(1);
    expect(second.uploadService.remove).not.toHaveBeenCalled();
  });

  it('keeps detail remove path and exposes delete/persistence partial failures', async () => {
    const deleteFailure = new Error('detail delete failed');
    const first = createService({
      remove: jest.fn().mockRejectedValue(deleteFailure),
    });

    await expect(
      first.service.Imageremove('store-1', owner as never, 0),
    ).rejects.toBe(deleteFailure);
    expect(first.uploadService.remove).toHaveBeenCalledWith(
      baseline.mediaPaths.storeDetail,
      store.detailImages[0].s3Url,
    );
    expect(first.storeRepository.updateOneById).not.toHaveBeenCalled();

    const persistFailure = new Error('detail removal persistence failed');
    const second = createService({
      update: jest.fn().mockRejectedValue(persistFailure),
    });
    await expect(
      second.service.Imageremove('store-1', owner as never, 0),
    ).rejects.toBe(persistFailure);
    expect(second.uploadService.remove).toHaveBeenCalledTimes(1);
  });
});
