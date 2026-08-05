import { Logger } from '@nestjs/common';
import { Roles } from 'src/modules/user/application/roles.enum';
import { UserNotOwnerException } from 'src/modules/user/application/exceptions/user-not-owner.exception';
import { ObjectStorageError } from 'src/integrations/media/application/object-storage.error';
import { CakeMediaService } from './cake-media.service';

const owner = { firebaseUid: 'owner-1', roles: [Roles.SELLER] };
const mediaFile = {
  originalName: 'cake.jpg',
  contentType: 'image/jpeg',
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
};
const oldImage = {
  name: 'old.jpg',
  converteName: 'old.jpg',
  key: 'legacy/cakes/old.jpg',
  s3Url: 'https://cdn.example.com/old.jpg',
};

describe('CakeMediaService', () => {
  function createService() {
    const objectStorage = {
      put: jest.fn().mockImplementation(async (request) => ({
        key: request.key,
        url: `https://cdn.example.com/${request.key}`,
      })),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const storeWriteContext = {
      findByIdOrThrow: jest.fn().mockResolvedValue({
        storeId: 'store-1',
        ownerUserId: 'owner-1',
      }),
    };
    const cakeRepository = {
      findByIdOrThrow: jest.fn().mockResolvedValue({
        id: 'cake-1',
        ownerStoreId: 'store-1',
        image: oldImage,
      }),
      updateOneById: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const metricsService = {
      countOrphan: jest.fn(),
    };
    return {
      service: new CakeMediaService(
        objectStorage as never,
        storeWriteContext as never,
        cakeRepository as never,
        metricsService as never,
      ),
      objectStorage,
      cakeRepository,
      metricsService,
    };
  }

  afterEach(() => jest.restoreAllMocks());

  it('replaces an image in upload -> Mongo -> previous-key delete order', async () => {
    const { service, objectStorage, cakeRepository } = createService();

    await expect(
      service.replaceImage('cake-1', owner as never, mediaFile),
    ).resolves.toEqual({ acknowledged: true });

    const request = objectStorage.put.mock.calls[0][0];
    expect(request.key).toMatch(/^store-1\/cakes\/[0-9a-f-]+\.jpg$/);
    expect(request.contentType).toBe('image/jpeg');
    expect(cakeRepository.updateOneById).toHaveBeenCalledWith('cake-1', {
      image: expect.objectContaining({ key: request.key }),
    });
    expect(objectStorage.delete).toHaveBeenCalledWith(oldImage.key);
    expect(objectStorage.put.mock.invocationCallOrder[0]).toBeLessThan(
      cakeRepository.updateOneById.mock.invocationCallOrder[0],
    );
    expect(
      cakeRepository.updateOneById.mock.invocationCallOrder[0],
    ).toBeLessThan(objectStorage.delete.mock.invocationCallOrder[0]);
  });

  it('rejects a spoofed client content type before S3', async () => {
    const { service, objectStorage, cakeRepository } = createService();

    await expect(
      service.replaceImage('cake-1', owner as never, {
        ...mediaFile,
        contentType: 'image/png',
      }),
    ).rejects.toMatchObject({ status: 415 });
    expect(objectStorage.put).not.toHaveBeenCalled();
    expect(cakeRepository.updateOneById).not.toHaveBeenCalled();
  });

  it('compensates the new image and propagates the original Mongo error', async () => {
    const { service, objectStorage, cakeRepository } = createService();
    const failure = new Error('Mongo update failed');
    cakeRepository.updateOneById.mockRejectedValue(failure);

    await expect(
      service.replaceImage('cake-1', owner as never, mediaFile),
    ).rejects.toBe(failure);
    expect(objectStorage.delete).toHaveBeenCalledTimes(1);
    expect(objectStorage.delete).toHaveBeenCalledWith(
      objectStorage.put.mock.calls[0][0].key,
    );
  });

  it('does not roll back Mongo when previous object cleanup fails', async () => {
    const { service, objectStorage, cakeRepository, metricsService } =
      createService();
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    objectStorage.delete.mockRejectedValue(
      new ObjectStorageError('delete', oldImage.key, new Error('S3 failed')),
    );

    await expect(
      service.replaceImage('cake-1', owner as never, mediaFile),
    ).resolves.toEqual({ acknowledged: true });
    expect(cakeRepository.updateOneById).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'cake_media_object_orphaned',
        key: oldImage.key,
        operation: 'replace_previous_image',
      }),
    );
    expect(metricsService.countOrphan).toHaveBeenCalledWith(
      'cake',
      'replace_previous_image',
    );
  });

  it('soft-deletes in Mongo before deleting the stored full key', async () => {
    const { service, objectStorage, cakeRepository, metricsService } =
      createService();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    objectStorage.delete.mockRejectedValue(
      new ObjectStorageError('delete', oldImage.key, new Error('S3 failed')),
    );

    await expect(service.softDelete('cake-1', owner as never)).resolves.toEqual(
      { acknowledged: true },
    );
    expect(cakeRepository.updateOneById).toHaveBeenCalledWith('cake-1', {
      isDeleted: true,
    });
    expect(objectStorage.delete).toHaveBeenCalledWith(oldImage.key);
    expect(
      cakeRepository.updateOneById.mock.invocationCallOrder[0],
    ).toBeLessThan(objectStorage.delete.mock.invocationCallOrder[0]);
    expect(metricsService.countOrphan).toHaveBeenCalledWith(
      'cake',
      'soft_delete',
    );
  });

  it('does not delete the object when Cake soft-delete persistence fails', async () => {
    const { service, objectStorage, cakeRepository } = createService();
    const failure = new Error('Mongo update failed');
    cakeRepository.updateOneById.mockRejectedValue(failure);

    await expect(service.softDelete('cake-1', owner as never)).rejects.toBe(
      failure,
    );
    expect(objectStorage.delete).not.toHaveBeenCalled();
  });

  it('allows owner/admin and rejects another seller before writes', async () => {
    const { service, objectStorage, cakeRepository } = createService();

    await expect(
      service.softDelete('cake-1', {
        firebaseUid: 'other-1',
        roles: [Roles.SELLER],
      } as never),
    ).rejects.toBeInstanceOf(UserNotOwnerException);
    expect(cakeRepository.updateOneById).not.toHaveBeenCalled();
    expect(objectStorage.delete).not.toHaveBeenCalled();
  });

  it('compensates an imported image by its stored full key', async () => {
    const { service, objectStorage } = createService();
    const importedImage = {
      ...oldImage,
      key: 'store-1/cakes/new-import.jpg',
    };

    await service.compensateImportImage(
      'store-1',
      importedImage,
      new Error('Cake create failed'),
    );

    expect(objectStorage.delete).toHaveBeenCalledWith(importedImage.key);
  });
});
