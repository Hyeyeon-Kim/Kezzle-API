import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from 'src/user/application/authenticated-user';
import { UserNotOwnerException } from 'src/user/exceptions/user-not-owner.exception';
import { Roles } from 'src/user/entities/roles.enum';
import { UploadService } from 'src/upload/upload.service';
import { ObjectId } from 'mongodb';
import * as XLSX from 'xlsx'; // TODO:나중에 이거 바꿔야함
import { CakeImportRow } from './application/cake-import-row';
import { AnniversaryService } from 'src/anniversary/anniversary.service';
import { CounterService } from 'src/counter/counter.service';
import { VitClient } from 'src/ai-search/vit-client';
import { ClipClient } from 'src/ai-search/clip-client';
import { StoreCakeWriteContextReader } from 'src/store/store-cake-write-context.reader';
import { CakeRepository } from './cake.repository';
import { CakeExternalMapper } from './cake-external.mapper';
import { CakePageView } from './application/cake-result.view';
import { CakeView } from './application/cake.view';
import { MediaFile } from 'src/upload/application/media-file';

interface CakeImportFiles {
  readonly image: MediaFile[];
  readonly excel: MediaFile[];
}

@Injectable()
export class CakeService {
  constructor(
    private readonly uploadService: UploadService,
    private readonly anniversaryService: AnniversaryService,
    private readonly counterService: CounterService,
    private readonly vitClient: VitClient,
    private readonly clipClient: ClipClient,
    private readonly storeWriteContext: StoreCakeWriteContextReader,
    private readonly cakeRepository: CakeRepository,
  ) {}
  async findAllByNewest(after: string, limit: number, maxTimeMs?: number) {
    if (Number.isNaN(limit)) {
      limit = 20;
    }

    let cakes = await this.cakeRepository.findNewest(
      after,
      limit + 1,
      maxTimeMs,
    );
    let hasMore = false;

    if (cakes.length > limit) {
      hasMore = true;
      cakes = cakes.slice(0, cakes.length - 1);
    }

    return { cakes, hasMore };
  }

  async findRecommendationSeed(
    user: AuthenticatedUser | undefined,
    maxTimeMs?: number,
  ): Promise<string | null> {
    const likedCakeIds = user?.cakeLikeIds ?? [];
    const randomIndex = Math.floor(Math.random() * likedCakeIds.length);
    const userLikedCakeId: string = likedCakeIds[randomIndex];

    if (
      userLikedCakeId === undefined ||
      (await this.cakeRepository.findById(userLikedCakeId, maxTimeMs)) === null
    ) {
      const sampledCake = await this.cakeRepository.sampleOne(maxTimeMs);
      return sampledCake?.id ?? null;
    }

    return userLikedCakeId;
  }

  async findAllByRecommend(
    seedCakeId: string,
    signal?: AbortSignal,
  ): Promise<CakeView[]> {
    const cakes = await this.vitClient.similarSearch(seedCakeId, 6, signal);

    return cakes.map((cake) => CakeExternalMapper.toView(cake));
  }

  async findOne(cakeid: string): Promise<CakeView> {
    return this.cakeRepository.findByIdOrThrow(cakeid);
  }

  async changeContent(
    cakeid: string,
    user: AuthenticatedUser,
    file: MediaFile,
  ) {
    const cake = await this.cakeRepository.findByIdOrThrow(cakeid);
    const store = await this.storeWriteContext.findByIdOrThrow(
      cake.ownerStoreId,
    );

    if (
      store.ownerUserId !== user.firebaseUid &&
      !user.roles.includes(Roles.ADMIN)
    ) {
      throw new UserNotOwnerException(user.firebaseUid, store.ownerUserId);
    }

    const path = store.storeName + '/cakes';

    await this.uploadService.remove(path, cake.image.s3Url);

    const image = await this.uploadService.create(path, file);
    return this.cakeRepository.updateOneById(cakeid, { image });
  }

  async removeContent(cakeid: string, user: AuthenticatedUser) {
    const cake = await this.cakeRepository.findByIdOrThrow(cakeid);
    const store = await this.storeWriteContext.findByIdOrThrow(
      cake.ownerStoreId,
    );
    if (
      // store.owner_user_id !== user.firebaseUid &&
      !user.roles.includes(Roles.ADMIN)
    ) {
      throw new UserNotOwnerException(user.firebaseUid, store.ownerUserId);
    }

    const path = store.storeName + '/cakes';

    await this.uploadService.remove(path, cake.image.s3Url);

    return await this.cakeRepository.updateOneById(cakeid, {
      isDeleted: true,
    });
  }

  async createCake(
    storeid: string,
    user: AuthenticatedUser,
    files: CakeImportFiles,
  ) {
    const workbook = await XLSX.read(files.excel[0].buffer, { type: 'buffer' });
    // 첫번째 sheet 의 이름을 조회합니다.
    const sheetName = await workbook.SheetNames[0];
    // 첫번째 sheet 를 사용합니다.
    const sheet = await workbook.Sheets[sheetName];
    // sheet 의 정보를 json array 로 변환합니다.
    const rows: CakeImportRow[] = await XLSX.utils.sheet_to_json(sheet, {
      // cell 에 값이 비어있으면 '' 을 기본값으로 설정합니다.
      defval: null,
    });

    const store = await this.storeWriteContext.findByIdOrThrow(storeid);
    if (
      store.ownerUserId !== user.firebaseUid &&
      !user.roles.includes(Roles.ADMIN)
    ) {
      throw new UserNotOwnerException(user.firebaseUid, store.ownerUserId);
    }
    const path = store.storeId + '/cakes';
    let cnt = 0;
    for (const img of files.image) {
      const image = await this.uploadService.create(path, img);
      const objectId = new ObjectId();
      const timestamp = objectId.getTimestamp();
      const timeValue = timestamp.getTime().toString().padStart(15, '0');
      const randomNum = Math.floor(Math.random() * 10000);
      const cursorValue = String(randomNum).padStart(6, '0') + timeValue;

      let content;

      for (let i = 0; i < rows.length; i++) {
        if (img.originalName === rows[i].img) {
          content = rows[i];
          break;
        }
      }

      const faissId: number =
        await this.counterService.getNextSequenceValue('cakes');

      if (content !== undefined) {
        const s = content.hash
          .split('#')
          .map((item) => item.trim())
          .filter((item) => item !== '');

        await this.cakeRepository.create({
          image,
          ownerStoreId: storeid,
          cursor: cursorValue,
          likeText: content.fav == null ? undefined : String(content.fav),
          tags: s,
          content: content.content,
          faissId,
        });
      } else {
        await this.cakeRepository.create({
          image,
          ownerStoreId: storeid,
          cursor: cursorValue,
          faissId,
        });
      }
      cnt++;
      if (cnt % 10 == 0) console.log(cnt + '개의 파일 업로드 성공');
    }
    console.log(cnt + '개의 파일 업로드 성공');
    return cnt + '개의 파일 업로드 성공';
  }

  async anniversary(anniId: string, page: number): Promise<CakePageView> {
    if (Number.isNaN(page)) page = 0;
    const anniversary =
      await this.anniversaryService.getAnniversaryWord(anniId);
    const keyword = anniversary.keyword.join(', ');
    const { result } = await this.clipClient.koSearchPage(keyword, 20, page);
    return {
      cakes: result.map((cake) => CakeExternalMapper.toView(cake)),
      hasMore: false,
    };
  }
}
