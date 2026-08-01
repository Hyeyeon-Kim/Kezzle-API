import { ImageValue } from 'src/common/image/application/image.value';

export interface CakeView {
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
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}
