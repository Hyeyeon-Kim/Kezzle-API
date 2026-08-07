import { Injectable, Logger } from '@nestjs/common';
import { CounterSequencePort } from 'src/modules/counter/application/port/counter-sequence.port';
import { StoreCakeWriteContextReader } from 'src/modules/store/application/port/store-cake-write-context.reader';
import { AuthenticatedUser } from 'src/platform/auth/authenticated-user';
import { UserNotOwnerException } from 'src/platform/auth/exception/user-not-owner.exception';
import { Roles } from 'src/platform/auth/roles.enum';
import { MediaFile } from 'src/integrations/media/application/media-file';
import { validateXlsxMediaFile } from 'src/integrations/media/application/media-file-signature.validator';
import * as XLSX from 'xlsx';
import { CakeImportRow } from './cake-import-row';
import { CakeMediaService } from '../media/cake-media.service';
import { CakeCursorGeneratorPort } from '../port/cake-cursor-generator.port';
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
    private readonly counterService: CounterSequencePort,
    private readonly storeWriteContext: StoreCakeWriteContextReader,
    private readonly cakeRepository: CakeRepositoryPort,
    private readonly cursorGenerator: CakeCursorGeneratorPort,
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
        const cursor = this.cursorGenerator.generate();
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
