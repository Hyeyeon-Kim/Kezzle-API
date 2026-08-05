import { Injectable } from '@nestjs/common';
import {
  StoreCakeWriteContext,
  StoreCakeWriteContextReader,
} from '../application/store-cake-write-context.reader';
import { StoreRepository } from './persistence/store.repository';

@Injectable()
export class StoreCakeWriteContextRepositoryAdapter
  implements StoreCakeWriteContextReader
{
  constructor(private readonly storeRepository: StoreRepository) {}

  async findByIdOrThrow(storeId: string): Promise<StoreCakeWriteContext> {
    const store = await this.storeRepository.findByIdOrThrow(storeId);
    return {
      storeId: store.id,
      ownerUserId: store.ownerUserId,
    };
  }
}
