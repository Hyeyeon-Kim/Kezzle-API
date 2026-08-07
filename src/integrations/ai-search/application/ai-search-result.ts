import { ImageValue } from 'src/shared/image/application/image.value';

export interface AiSearchCakeResult {
  readonly id: string;
  readonly image: ImageValue;
  readonly cursor?: string;
  readonly likedUserIds: string[];
  readonly ownerStoreId: string;
  readonly likeText?: string;
  readonly tags: string[];
  readonly content?: string;
  readonly calculatedLikes?: number;
  readonly faissId?: number;
  readonly isDeleted: boolean;
  readonly score?: number;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
  readonly extra: Readonly<Record<string, unknown>>;
}

export interface AiSearchCakePageResult {
  readonly result: AiSearchCakeResult[];
  readonly nextPage?: number;
  readonly isLastPage?: boolean;
}
