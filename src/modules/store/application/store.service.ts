import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from 'src/platform/auth/authenticated-user';
import { UserNotOwnerException } from 'src/platform/auth/exception/user-not-owner.exception';
import { Roles } from 'src/platform/auth/roles.enum';
import {
  CreateStoreData,
  UpdateStoreData,
} from 'src/modules/store/application/store.command';
import { StoreView } from 'src/modules/store/application/store.view';
import { StoreRepositoryPort } from './port/store-repository.port';

@Injectable()
export class StoreService {
  constructor(private readonly storeRepository: StoreRepositoryPort) {}

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
