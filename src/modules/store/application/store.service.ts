import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from 'src/modules/user/application/authenticated-user';
import { UserNotOwnerException } from 'src/modules/user/application/exceptions/user-not-owner.exception';
import { Roles } from 'src/modules/user/application/roles.enum';
import { CreateStoreData, UpdateStoreData } from './store.command';
import { StoreView } from './store.view';
import { StoreRepository } from '../infrastructure/persistence/store.repository';

@Injectable()
export class StoreService {
  constructor(private readonly storeRepository: StoreRepository) {}

  async create(data: CreateStoreData): Promise<StoreView> {
    return this.storeRepository.create(data);
  }

  async findOne(storeId: string): Promise<StoreView> {
    return this.storeRepository.findByIdOrThrow(storeId);
  }

  async changeContent(
    storeId: string,
    updateData: UpdateStoreData,
    user: AuthenticatedUser,
  ) {
    const store = await this.storeRepository.findByIdOrThrow(storeId);
    this.assertOwnerOrAdmin(store.ownerUserId, user);
    return this.storeRepository.updateOneById(storeId, updateData);
  }

  async removeContent(storeId: string, user: AuthenticatedUser) {
    const store = await this.storeRepository.findByIdOrThrow(storeId);
    this.assertOwnerOrAdmin(store.ownerUserId, user);
    return this.storeRepository.deleteById(storeId);
  }

  private assertOwnerOrAdmin(
    ownerUserId: string,
    user: AuthenticatedUser,
  ): void {
    if (ownerUserId !== user.firebaseUid && !user.roles.includes(Roles.ADMIN)) {
      throw new UserNotOwnerException(user.firebaseUid, ownerUserId);
    }
  }
}
