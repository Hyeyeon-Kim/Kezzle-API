import { AnniversaryView } from '../query/anniversary.view';

export abstract class AnniversaryRepositoryPort {
  abstract findById(id: string): Promise<AnniversaryView | null>;
  abstract findNext(maxTimeMs?: number): Promise<AnniversaryView | null>;
}
