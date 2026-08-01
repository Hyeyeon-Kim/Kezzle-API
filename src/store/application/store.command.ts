import { ImageValue } from 'src/common/image/application/image.value';
import { StoreLocationView } from './store.view';

export interface CreateStoreData {
  readonly name: string;
  readonly logo?: ImageValue;
  readonly feature?: string;
  readonly description?: string;
  readonly instagramUrl?: string;
  readonly kakaoChannelUrl?: string;
  readonly location: StoreLocationView;
  readonly address: string;
  readonly phoneNumber?: string;
  readonly ownerUserId: string;
  readonly detailImages?: ImageValue[];
  readonly operatingTime: string[];
  readonly taste: string[];
}

export interface UpdateStoreData {
  readonly feature?: string;
  readonly description?: string;
  readonly instagramUrl?: string;
  readonly kakaoChannelUrl?: string;
  readonly location?: StoreLocationView;
  readonly address?: string;
  readonly phoneNumber?: string;
  readonly detailImages?: ImageValue[];
  readonly operatingTime?: string[];
  readonly taste?: string[];
  readonly logo?: ImageValue;
}
