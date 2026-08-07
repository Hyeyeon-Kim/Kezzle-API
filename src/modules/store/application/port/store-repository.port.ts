import { WriteResult } from 'src/shared/application/write-result';
import { CreateStoreData, UpdateStoreData } from '../store.command';
import { StoreView } from '../store.view';

export abstract class StoreRepositoryPort {
  abstract findByIdOrThrow(id: string): Promise<StoreView>;
  abstract create(data: CreateStoreData): Promise<StoreView>;
  abstract updateOneById(
    id: string,
    data: UpdateStoreData,
  ): Promise<WriteResult>;
  abstract deleteById(id: string): Promise<WriteResult>;
}
