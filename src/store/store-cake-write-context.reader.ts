export interface StoreCakeWriteContext {
  readonly storeId: string;
  readonly ownerUserId: string;
  readonly storeName: string;
}

export abstract class StoreCakeWriteContextReader {
  abstract findByIdOrThrow(storeId: string): Promise<StoreCakeWriteContext>;
}
