import { ImageValue } from 'src/shared/image/application/image.value';

export interface Cake {
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

export interface CreateCakeData {
  readonly image: ImageValue;
  readonly ownerStoreId: string;
  readonly cursor: string;
  readonly likeText?: string;
  readonly tags?: string[];
  readonly content?: string;
  readonly faissId: number;
}

export interface UpdateCakeData {
  readonly image?: ImageValue;
  readonly isDeleted?: boolean;
}
