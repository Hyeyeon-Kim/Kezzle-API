import { ImageValue } from 'src/common/image/application/image.value';

export interface StoreLocationView {
  readonly latitude: number;
  readonly longitude: number;
}

export interface StoreView {
  readonly id: string;
  readonly name: string;
  readonly logo?: ImageValue | null;
  readonly feature: string;
  readonly description: string;
  readonly instagramUrl: string;
  readonly kakaoChannelUrl: string;
  readonly kakaoMapUrl: string;
  readonly location?: StoreLocationView;
  readonly address: string;
  readonly phoneNumber: string;
  readonly ownerUserId: string;
  readonly detailImages: ImageValue[];
  readonly operatingTime: string[];
  readonly likedUserIds: string[];
  readonly taste: string[];
  readonly distance?: number;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export interface StoreSummaryView {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly taste: string[];
  readonly longitude?: number;
  readonly latitude?: number;
}
