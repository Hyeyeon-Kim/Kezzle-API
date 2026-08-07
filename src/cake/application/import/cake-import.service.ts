import { Injectable, Logger } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { CounterService } from 'src/counter/infrastructure/persistence/counter.service';
import { StoreCakeWriteContextReader } from 'src/store/application/port/store-cake-write-context.reader';
import { AuthenticatedUser } from 'src/user/application/authenticated-user';
import { Roles } from 'src/user/domain/roles.enum';
import { UserNotOwnerException } from 'src/user/domain/exception/user-not-owner.exception';
import { MediaFile } from 'src/media/application/media-file';
import { validateXlsxMediaFile } from 'src/media/application/media-file-signature.validator';
import * as XLSX from 'xlsx';
import { CakeImportRow } from './cake-import-row';
import { CakeMediaService } from '../media/cake-media.service';
import { CakeRepositoryPort } from '../port/cake-repository.port';

export interface CakeImportFiles {
  readonly image: MediaFile[];
  readonly excel: MediaFile[];
}

@Injectable()
export class CakeImportService {
  private readonly logger = new Logger(CakeImportService.name);

  constructor(
    private readonly cakeMediaService: CakeMediaService,
    private readonly counterService: CounterService,
    private readonly storeWriteContext: StoreCakeWriteContextReader,
    private readonly cakeRepository: CakeRepositoryPort,
  ) {}

  async import(
    storeId: string,
    user: AuthenticatedUser,
    files: CakeImportFiles,
  ): Promise<string> {
    const store = await this.storeWriteContext.findByIdOrThrow(storeId);
    this.assertOwnerOrAdmin(store.ownerUserId, user);
    const excelFile = validateXlsxMediaFile(files.excel[0]);
    const rows = this.parseRows(excelFile.buffer);
    const rowsByImageName = this.indexRowsByImageName(rows);
    let succeeded = 0;

    for (const imageFile of files.image) {
      let uploadedImage;
      try {
        uploadedImage = await this.cakeMediaService.uploadImportImage(
          store.storeId,
          imageFile,
        );
        const content = rowsByImageName.get(imageFile.originalName);
        const objectId = new ObjectId();
        const timestamp = objectId.getTimestamp();
        const timeValue = timestamp.getTime().toString().padStart(15, '0');
        const randomNum = Math.floor(Math.random() * 10000);
        const cursor = String(randomNum).padStart(6, '0') + timeValue;
        const faissId = await this.counterService.getNextSequenceValue('cakes');

        await this.cakeRepository.create({
          image: uploadedImage,
          ownerStoreId: store.storeId,
          cursor,
          likeText: content?.fav == null ? undefined : String(content.fav),
          tags: content?.hash
            .split('#')
            .map((item) => item.trim())
            .filter((item) => item !== ''),
          content: content?.content,
          faissId,
        });
        succeeded++;
        if (succeeded % 10 === 0) {
          this.recordProgress(store.storeId, succeeded, files.image.length);
        }
      } catch (error) {
        if (uploadedImage !== undefined) {
          await this.cakeMediaService.compensateImportImage(
            store.storeId,
            uploadedImage,
            error,
          );
        }
        this.logger.error({
          event: 'cake_import_row_failed',
          storeId: store.storeId,
          fileName: imageFile.originalName,
          succeeded,
          total: files.image.length,
          error: this.errorDetails(error),
        });
        throw error;
      }
    }

    this.recordProgress(store.storeId, succeeded, files.image.length);
    return `${succeeded}개의 파일 업로드 성공`;
  }

  private parseRows(buffer: Buffer): CakeImportRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: null });
  }

  private indexRowsByImageName(
    rows: CakeImportRow[],
  ): Map<string, CakeImportRow> {
    const indexed = new Map<string, CakeImportRow>();
    for (const row of rows) {
      if (!indexed.has(row.img)) indexed.set(row.img, row);
    }
    return indexed;
  }

  private recordProgress(storeId: string, succeeded: number, total: number) {
    this.logger.log({
      event: 'cake_import_progress',
      storeId,
      succeeded,
      total,
    });
  }

  private errorDetails(error: unknown) {
    return error instanceof Error
      ? { name: error.name, message: error.message }
      : { value: String(error) };
  }

  private assertOwnerOrAdmin(
    ownerUserId: string,
    user: AuthenticatedUser,
  ): void {
    if (ownerUserId !== user.firebaseUid && !user.roles.includes(Roles.ADMIN)) {
      throw new UserNotOwnerException(user.firebaseUid, ownerUserId);
    }
  }
}
