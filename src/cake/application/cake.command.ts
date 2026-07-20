import { ImageValue } from 'src/common/image/application/image.value';

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
