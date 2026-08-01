import { CurationCakeSnapshotView } from './curation.view';

export interface CreateCurationData {
  readonly cakes: CurationCakeSnapshotView[];
  readonly key: string;
  readonly description: string;
  readonly note: string;
}
