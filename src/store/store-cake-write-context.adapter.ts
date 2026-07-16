import { Injectable } from '@nestjs/common';
import {
  StoreCakeWriteContext,
  StoreCakeWriteContextReader,
} from './store-cake-write-context.reader';
import { StoreRepository } from './store.repository';

@Injectable()
export class StoreCakeWriteContextRepositoryAdapter
  implements StoreCakeWriteContextReader
{
  constructor(private readonly storeRepository: StoreRepository) {}

  async findByIdOrThrow(storeId: string): Promise<StoreCakeWriteContext> {
    const store = await this.storeRepository.findByIdOrThrow(storeId);
    return {
      storeId: store?._id?.toString() ?? store?.id?.toString(),
      ownerUserId: store?.owner_user_id,
      storeName: store?.name,
    };
  }
}
