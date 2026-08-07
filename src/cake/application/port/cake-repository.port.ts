import { WriteResult } from 'src/common/application/write-result';
import { Cake, CreateCakeData, UpdateCakeData } from '../../domain/cake';

export abstract class CakeRepositoryPort {
  abstract findById(id: string, maxTimeMs?: number): Promise<Cake | null>;
  abstract findByIdOrThrow(id: string): Promise<Cake>;
  abstract sampleOne(maxTimeMs?: number): Promise<Cake | null>;
  abstract findInStoresByCursor(
    storeIds: string[],
    after: string,
    limit: number,
  ): Promise<Cake[]>;
  abstract findInStoresAfterId(
    storeIds: string[],
    after: string,
    limit: number,
  ): Promise<Cake[]>;
  abstract findNewest(
    after: string,
    limit: number,
    maxTimeMs?: number,
  ): Promise<Cake[]>;
  abstract findByStoreIdAfter(
    storeId: string,
    after: string,
    limit: number,
  ): Promise<Cake[]>;
  abstract create(data: CreateCakeData): Promise<Cake>;
  abstract updateOneById(
    id: string,
    data: UpdateCakeData,
  ): Promise<WriteResult>;
  abstract findByIds(ids: string[]): Promise<Cake[]>;
  abstract addUserLike(cakeId: string, userId: string): Promise<void>;
  abstract removeUserLike(cakeId: string, userId: string): Promise<void>;
  abstract findRecentByStoreIds(
    storeIds: string[],
    perStoreLimit?: number,
  ): Promise<Map<string, Cake[]>>;
}
