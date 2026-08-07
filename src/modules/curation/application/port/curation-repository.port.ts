import { CreateCurationData } from '../curation.command';
import {
  CurationCakeSnapshotView,
  CurationView,
  StaleCurationView,
} from '../curation.view';
import { WriteResult } from 'src/shared/application/write-result';

export abstract class CurationRepository {
  abstract create(data: CreateCurationData): Promise<CurationView>;

  abstract findByIdOrThrow(id: string): Promise<CurationView>;

  abstract updateCakes(
    id: string,
    cakes: CurationCakeSnapshotView[],
  ): Promise<WriteResult>;

  abstract findFeatured(
    limit: number,
    maxTimeMs?: number,
  ): Promise<CurationView[]>;

  abstract findStale(before: Date): Promise<StaleCurationView[]>;

  abstract claimRefresh(
    id: string,
    expectedUpdatedAt: Date | undefined,
    claimedBefore: Date,
    claimedAt: Date,
  ): Promise<boolean>;
}
