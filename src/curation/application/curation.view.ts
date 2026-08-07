import { Cake } from 'src/cake/domain/cake';

export interface CurationImageView {
  readonly name?: string;
  readonly converteName?: string;
  readonly key?: string;
  readonly s3Url: string;
}

export interface CurationCakeSnapshotView {
  readonly id: string;
  readonly image?: CurationImageView;
  readonly ownerStoreId?: string;
  readonly cursor?: string;
  readonly tags: string[];
  readonly likedUserIds: string[];
  readonly score?: number;
  readonly extra: Readonly<Record<string, unknown>>;
}

export interface CurationView {
  readonly id: string;
  readonly cakes: CurationCakeSnapshotView[];
  readonly key: string;
  readonly description: string;
  readonly note: string;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
  readonly version?: number;
}

export interface CurationDetailView {
  readonly description: string;
  readonly cakes: Cake[];
}

export interface StaleCurationView {
  readonly id: string;
  readonly updatedAt?: Date;
}
