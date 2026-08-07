import { Logger } from '@nestjs/common';
import { UserNotOwnerException } from 'src/platform/auth/exception/user-not-owner.exception';
import { Roles } from 'src/platform/auth/roles.enum';
import { ObjectStorageError } from 'src/integrations/media/application/object-storage.error';
import { MediaUploadException } from 'src/platform/http/exception/media-upload.exception';
import { StoreMediaService } from './store-media.service';

const owner = { firebaseUid: 'owner-1', roles: [Roles.SELLER] };
const mediaFile = {
  originalName: 'store.png',
  contentType: 'image/png',
  buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
};
const oldLogo = {
  name: 'old-logo.png',
  converteName: 'old-logo.png',
  key: 'legacy-store/logo/old-logo.png',
  s3Url: 'https://cdn.example.com/old-logo.png',
};
const detailImages = [
  {
    name: 'detail-1.png',
    converteName: 'detail-1.png',
    key: 'legacy-store/detail/detail-1.png',
    s3Url: 'https://cdn.example.com/detail-1.png',
  },
  {
    name: 'detail-2.png',
    converteName: 'detail-2.png',
    key: 'legacy-store/detail/detail-2.png',
    s3Url: 'https://cdn.example.com/detail-2.png',
  },
];

describe('StoreMediaService', () => {
  function createService() {
    const objectStorage = {
      put: jest.fn().mockImplementation(async (request) => ({
        key: request.key,
        url: `https://cdn.example.com/${request.key}`,
      })),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const storeRepository = {
      findByIdOrThrow: jest.fn().mockResolvedValue({
        id: 'store-1',
        ownerUserId: 'owner-1',
        logo: oldLogo,
        detailImages,
      }),
      updateOneById: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const metricsService = {
      countOrphan: jest.fn(),
    };
    return {
      service: new StoreMediaService(
        objectStorage as never,
        storeRepository as never,
        metricsService as never,
      ),
      objectStorage,
      storeRepository,
      metricsService,
    };
  }

  afterEach(() => jest.restoreAllMocks());

  it('replaces a logo in upload -> Mongo -> previous-key delete order', async () => {
    const { service, objectStorage, storeRepository } = createService();

    await expect(
      service.replaceLogo('store-1', owner as never, mediaFile),
    ).resolves.toEqual({ acknowledged: true });

    const putRequest = objectStorage.put.mock.calls[0][0];
    expect(putRequest).toEqual({
      key: expect.stringMatching(/^store-1\/logo\/[0-9a-f-]+\.png$/),
      body: mediaFile.buffer,
      contentType: 'image/png',
    });
    expect(storeRepository.updateOneById).toHaveBeenCalledWith('store-1', {
      logo: expect.objectContaining({ key: putRequest.key }),
    });
    expect(objectStorage.delete).toHaveBeenCalledWith(oldLogo.key);
    expect(objectStorage.put.mock.invocationCallOrder[0]).toBeLessThan(
      storeRepository.updateOneById.mock.invocationCallOrder[0],
    );
    expect(
      storeRepository.updateOneById.mock.invocationCallOrder[0],
    ).toBeLessThan(objectStorage.delete.mock.invocationCallOrder[0]);
  });

  it('rejects signature mismatch without forwarding client MIME to S3', async () => {
    const { service, objectStorage, storeRepository } = createService();

    await expect(
      service.replaceLogo('store-1', owner as never, {
        ...mediaFile,
        buffer: Buffer.from('<html></html>'),
      }),
    ).rejects.toMatchObject({ status: 415 });
    expect(objectStorage.put).not.toHaveBeenCalled();
    expect(storeRepository.updateOneById).not.toHaveBeenCalled();
  });

  it('deletes the new logo as compensation when Mongo update fails', async () => {
    const { service, objectStorage, storeRepository } = createService();
    const failure = new Error('Mongo update failed');
    storeRepository.updateOneById.mockRejectedValue(failure);

    await expect(
      service.replaceLogo('store-1', owner as never, mediaFile),
    ).rejects.toBe(failure);

    const newKey = objectStorage.put.mock.calls[0][0].key;
    expect(objectStorage.delete).toHaveBeenCalledTimes(1);
    expect(objectStorage.delete).toHaveBeenCalledWith(newKey);
    expect(objectStorage.delete).not.toHaveBeenCalledWith(oldLogo.key);
  });

  it('keeps the original Mongo error and records the new object when compensation fails', async () => {
    const { service, objectStorage, storeRepository, metricsService } =
      createService();
    const failure = new Error('Mongo update failed');
    storeRepository.updateOneById.mockRejectedValue(failure);
    objectStorage.delete.mockRejectedValue(
      new ObjectStorageError('delete', 'new-key', new Error('S3 failed')),
    );
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(
      service.replaceLogo('store-1', owner as never, mediaFile),
    ).rejects.toBe(failure);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'store_media_object_orphaned',
        key: objectStorage.put.mock.calls[0][0].key,
        operation: 'replace_logo_compensation',
      }),
    );
    expect(metricsService.countOrphan).toHaveBeenCalledWith(
      'store',
      'replace_logo_compensation',
    );
  });

  it('returns Mongo success and records an orphan when previous logo delete fails', async () => {
    const { service, objectStorage, metricsService } = createService();
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    objectStorage.delete.mockRejectedValue(
      new ObjectStorageError('delete', oldLogo.key, new Error('S3 failed')),
    );

    await expect(
      service.replaceLogo('store-1', owner as never, mediaFile),
    ).resolves.toEqual({ acknowledged: true });
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'store_media_object_orphaned',
        key: oldLogo.key,
        operation: 'replace_previous_logo',
      }),
    );
    expect(metricsService.countOrphan).toHaveBeenCalledWith(
      'store',
      'replace_previous_logo',
    );
  });

  it('compensates a newly uploaded detail image when Mongo update fails', async () => {
    const { service, objectStorage, storeRepository } = createService();
    const failure = new Error('Mongo update failed');
    storeRepository.updateOneById.mockRejectedValue(failure);

    await expect(
      service.addDetailImage('store-1', owner as never, mediaFile),
    ).rejects.toBe(failure);
    expect(objectStorage.delete).toHaveBeenCalledWith(
      objectStorage.put.mock.calls[0][0].key,
    );
  });

  it('removes the Mongo reference before deleting the stored full key', async () => {
    const { service, objectStorage, storeRepository, metricsService } =
      createService();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    objectStorage.delete.mockRejectedValue(
      new ObjectStorageError(
        'delete',
        detailImages[0].key,
        new Error('S3 failed'),
      ),
    );

    await expect(
      service.removeDetailImage('store-1', owner as never, 0),
    ).resolves.toEqual({ acknowledged: true });
    expect(storeRepository.updateOneById).toHaveBeenCalledWith('store-1', {
      detailImages: [detailImages[1]],
    });
    expect(objectStorage.delete).toHaveBeenCalledWith(detailImages[0].key);
    expect(
      storeRepository.updateOneById.mock.invocationCallOrder[0],
    ).toBeLessThan(objectStorage.delete.mock.invocationCallOrder[0]);
    expect(metricsService.countOrphan).toHaveBeenCalledWith(
      'store',
      'remove_detail_image',
    );
  });

  it('does not delete a detail object when Mongo reference removal fails', async () => {
    const { service, objectStorage, storeRepository } = createService();
    const failure = new Error('Mongo update failed');
    storeRepository.updateOneById.mockRejectedValue(failure);

    await expect(
      service.removeDetailImage('store-1', owner as never, 0),
    ).rejects.toBe(failure);
    expect(objectStorage.delete).not.toHaveBeenCalled();
  });

  it('rejects non-owners before storage access', async () => {
    const { service, objectStorage, storeRepository } = createService();

    await expect(
      service.addDetailImage(
        'store-1',
        { firebaseUid: 'other-1', roles: [Roles.SELLER] } as never,
        mediaFile,
      ),
    ).rejects.toBeInstanceOf(UserNotOwnerException);
    expect(objectStorage.put).not.toHaveBeenCalled();
    expect(storeRepository.updateOneById).not.toHaveBeenCalled();
  });

  it('keeps the existing upload HTTP exception contract', async () => {
    const { service, objectStorage } = createService();
    objectStorage.put.mockRejectedValue(
      new ObjectStorageError('put', 'store-1/logo/new.png', new Error()),
    );

    await expect(
      service.replaceLogo('store-1', owner as never, mediaFile),
    ).rejects.toBeInstanceOf(MediaUploadException);
  });
});
