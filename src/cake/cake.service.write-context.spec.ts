import { Roles } from 'src/user/entities/roles.enum';
import { UserNotOwnerException } from 'src/user/exceptions/user-not-owner.exception';
import * as XLSX from 'xlsx';
import { CakeService } from './cake.service';

const storeContext = {
  storeId: 'store-1',
  ownerUserId: 'owner-1',
  storeName: 'Store Name',
};

const cake = {
  id: 'cake-1',
  ownerStoreId: 'store-1',
  image: { s3Url: 'old-cake.jpg' },
};

const user = (firebaseUid: string, roles: Roles[]) => ({
  firebaseUid,
  roles,
});

const buildService = ({
  uploadService = {},
  counterService = {},
  storeWriteContext = {},
  cakeRepository = {},
}: Record<string, any>) =>
  new CakeService(
    uploadService as any,
    {} as any,
    {} as any,
    counterService as any,
    {} as any,
    {} as any,
    storeWriteContext as any,
    cakeRepository as any,
  );

describe('CakeService StoreCakeWriteContextReader boundary', () => {
  it('allows the owner to replace cake content with the existing store-name path', async () => {
    const uploadService = {
      remove: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue({ s3Url: 'new-cake.jpg' }),
    };
    const storeWriteContext = {
      findByIdOrThrow: jest.fn().mockResolvedValue(storeContext),
    };
    const cakeRepository = {
      findByIdOrThrow: jest.fn().mockResolvedValue(cake),
      updateOneById: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const service = buildService({
      uploadService,
      storeWriteContext,
      cakeRepository,
    });

    await service.changeContent(
      'cake-1',
      user('owner-1', [Roles.SELLER]) as any,
      { buffer: Buffer.from('image') },
    );

    expect(storeWriteContext.findByIdOrThrow).toHaveBeenCalledWith('store-1');
    expect(uploadService.remove).toHaveBeenCalledWith(
      'Store Name/cakes',
      'old-cake.jpg',
    );
    expect(uploadService.create).toHaveBeenCalledWith(
      'Store Name/cakes',
      expect.anything(),
    );
  });

  it('keeps another seller forbidden before storage writes', async () => {
    const uploadService = { remove: jest.fn(), create: jest.fn() };
    const service = buildService({
      uploadService,
      storeWriteContext: {
        findByIdOrThrow: jest.fn().mockResolvedValue(storeContext),
      },
      cakeRepository: { findByIdOrThrow: jest.fn().mockResolvedValue(cake) },
    });

    await expect(
      service.changeContent(
        'cake-1',
        user('other-1', [Roles.SELLER]) as any,
        {},
      ),
    ).rejects.toBeInstanceOf(UserNotOwnerException);
    expect(uploadService.remove).not.toHaveBeenCalled();
  });

  it('keeps cake removal admin-only and uses the store-name path', async () => {
    const uploadService = { remove: jest.fn().mockResolvedValue(undefined) };
    const storeWriteContext = {
      findByIdOrThrow: jest.fn().mockResolvedValue(storeContext),
    };
    const cakeRepository = {
      findByIdOrThrow: jest.fn().mockResolvedValue(cake),
      updateOneById: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const service = buildService({
      uploadService,
      storeWriteContext,
      cakeRepository,
    });

    await expect(
      service.removeContent('cake-1', user('owner-1', [Roles.SELLER]) as any),
    ).rejects.toBeInstanceOf(UserNotOwnerException);

    await service.removeContent(
      'cake-1',
      user('admin-1', [Roles.ADMIN]) as any,
    );

    expect(uploadService.remove).toHaveBeenCalledWith(
      'Store Name/cakes',
      'old-cake.jpg',
    );
    expect(cakeRepository.updateOneById).toHaveBeenCalledWith('cake-1', {
      isDeleted: true,
    });
  });

  it('keeps cake creation on the store-id storage path', async () => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation();
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([['img']]),
      'cakes',
    );
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });
    const imageFile = { originalname: 'cake.jpg' };
    const uploadService = {
      create: jest.fn().mockResolvedValue({ s3Url: 'cake.jpg' }),
    };
    const cakeRepository = { create: jest.fn().mockResolvedValue(cake) };
    const service = buildService({
      uploadService,
      counterService: {
        getNextSequenceValue: jest.fn().mockResolvedValue(1),
      },
      storeWriteContext: {
        findByIdOrThrow: jest.fn().mockResolvedValue(storeContext),
      },
      cakeRepository,
    });

    await service.createCake(
      'store-1',
      user('owner-1', [Roles.SELLER]) as any,
      { excel: [{ buffer: excelBuffer }], image: [imageFile] },
    );

    expect(uploadService.create).toHaveBeenCalledWith(
      'store-1/cakes',
      imageFile,
    );
    expect(cakeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerStoreId: 'store-1', faissId: 1 }),
    );
    consoleLog.mockRestore();
  });

  it('preserves a blank favorite and stringifies only numeric favorites', async () => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation();
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['img', 'fav', 'content', 'hash'],
        ['blank-fav.jpg', null, 'blank favorite', '#blank'],
        ['numeric-fav.jpg', 12, 'numeric favorite', '#numeric'],
      ]),
      'cakes',
    );
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });
    const imageFiles = [
      { originalname: 'blank-fav.jpg' },
      { originalname: 'numeric-fav.jpg' },
    ];
    const cakeRepository = {
      create: jest.fn().mockResolvedValue(cake),
    };
    const service = buildService({
      uploadService: {
        create: jest.fn().mockResolvedValue({ s3Url: 'cake.jpg' }),
      },
      counterService: {
        getNextSequenceValue: jest
          .fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(2),
      },
      storeWriteContext: {
        findByIdOrThrow: jest.fn().mockResolvedValue(storeContext),
      },
      cakeRepository,
    });

    await service.createCake(
      'store-1',
      user('owner-1', [Roles.SELLER]) as any,
      { excel: [{ buffer: excelBuffer }], image: imageFiles },
    );

    expect(cakeRepository.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        likeText: undefined,
        content: 'blank favorite',
        tags: ['blank'],
      }),
    );
    expect(cakeRepository.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        likeText: '12',
        content: 'numeric favorite',
        tags: ['numeric'],
      }),
    );
    consoleLog.mockRestore();
  });
});
