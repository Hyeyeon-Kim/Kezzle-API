import { Logger } from '@nestjs/common';
import { Roles } from 'src/platform/auth/roles.enum';
import * as XLSX from 'xlsx';
import { CakeImportService } from './cake-import.service';

const owner = { firebaseUid: 'owner-1', roles: [Roles.SELLER] };
const imageFile = (originalName: string) => ({
  originalName,
  contentType: 'image/jpeg',
  buffer: Buffer.from(originalName),
});

function excelFile(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    'cakes',
  );
  return {
    originalName: 'cakes.xlsx',
    contentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
  };
}

describe('CakeImportService', () => {
  function createService() {
    let uploadCount = 0;
    const cakeMediaService = {
      uploadImportImage: jest.fn().mockImplementation(async (_, file) => {
        uploadCount++;
        return {
          name: file.originalName,
          converteName: `converted-${uploadCount}.jpg`,
          key: `store-1/cakes/converted-${uploadCount}.jpg`,
          s3Url: `https://cdn.example.com/converted-${uploadCount}.jpg`,
        };
      }),
      compensateImportImage: jest.fn().mockResolvedValue(undefined),
    };
    const counterService = {
      getNextSequenceValue: jest.fn().mockResolvedValue(1),
    };
    const storeWriteContext = {
      findByIdOrThrow: jest.fn().mockResolvedValue({
        storeId: 'store-1',
        ownerUserId: 'owner-1',
      }),
    };
    const cakeRepository = {
      create: jest.fn().mockResolvedValue({ id: 'cake-1' }),
    };
    const cursorGenerator = {
      generate: jest.fn().mockReturnValue('legacy-cursor'),
    };
    return {
      service: new CakeImportService(
        cakeMediaService as never,
        counterService as never,
        storeWriteContext as never,
        cakeRepository as never,
        cursorGenerator as never,
      ),
      cakeMediaService,
      counterService,
      cakeRepository,
      cursorGenerator,
    };
  }

  afterEach(() => jest.restoreAllMocks());

  it('matches XLSX rows to images and preserves the success response', async () => {
    const { service, cakeRepository, cursorGenerator } = createService();
    const progress = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    await expect(
      service.import('store-1', owner as never, {
        excel: [
          excelFile([
            ['img', 'fav', 'content', 'hash'],
            ['blank.jpg', null, 'blank favorite', '#blank'],
            ['numeric.jpg', 12, 'numeric favorite', '#numeric'],
          ]),
        ],
        image: [imageFile('blank.jpg'), imageFile('numeric.jpg')],
      }),
    ).resolves.toBe('2개의 파일 업로드 성공');

    expect(cakeRepository.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        ownerStoreId: 'store-1',
        cursor: 'legacy-cursor',
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
    expect(cursorGenerator.generate).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenCalledWith({
      event: 'cake_import_progress',
      storeId: 'store-1',
      succeeded: 2,
      total: 2,
    });
  });

  it('compensates only the failed row upload and records partial progress', async () => {
    const { service, cakeMediaService, cakeRepository } = createService();
    const failure = new Error('Cake create failed');
    cakeRepository.create
      .mockResolvedValueOnce({ id: 'cake-1' })
      .mockRejectedValueOnce(failure);
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(
      service.import('store-1', owner as never, {
        excel: [excelFile([['img']])],
        image: [imageFile('first.jpg'), imageFile('second.jpg')],
      }),
    ).rejects.toBe(failure);

    expect(cakeMediaService.compensateImportImage).toHaveBeenCalledTimes(1);
    expect(cakeMediaService.compensateImportImage).toHaveBeenCalledWith(
      'store-1',
      expect.objectContaining({ name: 'second.jpg' }),
      failure,
    );
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'cake_import_row_failed',
        fileName: 'second.jpg',
        succeeded: 1,
        total: 2,
      }),
    );
  });

  it('compensates an uploaded row when counter allocation fails', async () => {
    const { service, cakeMediaService, counterService, cakeRepository } =
      createService();
    const failure = new Error('Counter failed');
    counterService.getNextSequenceValue.mockRejectedValue(failure);
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(
      service.import('store-1', owner as never, {
        excel: [excelFile([['img']])],
        image: [imageFile('cake.jpg')],
      }),
    ).rejects.toBe(failure);
    expect(cakeMediaService.compensateImportImage).toHaveBeenCalledWith(
      'store-1',
      expect.objectContaining({ name: 'cake.jpg' }),
      failure,
    );
    expect(cakeRepository.create).not.toHaveBeenCalled();
  });
});
