import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/user/infrastructure/persistence/schema/user.schema';
import { UserNotFoundException } from 'src/user/domain/exception/user-not-found.exception';
import { UserView } from 'src/user/application/user.view';
import {
  CreateUserData,
  UpdateUserData,
} from 'src/user/application/user.command';
import { UserPersistenceMapper } from './user.persistence-mapper';
import { WriteResult } from 'src/common/application/write-result';

@Injectable()
export class UserRepository {
  constructor(
    @InjectModel(User.name, 'kezzle')
    private readonly userModel: Model<User>,
  ) {}

  async findByFirebaseUid(firebaseUid: string): Promise<UserView | null> {
    const user = await this.userModel.findOne({ firebaseUid });
    return user ? UserPersistenceMapper.toView(user) : null;
  }

  async findByFirebaseUidOrThrow(firebaseUid: string): Promise<UserView> {
    let user: User | null;
    try {
      user = await this.userModel.findOne({ firebaseUid });
    } catch {
      throw new UserNotFoundException(firebaseUid);
    }
    if (!user) {
      throw new UserNotFoundException(firebaseUid);
    }
    return UserPersistenceMapper.toView(user);
  }

  async findAll(): Promise<UserView[]> {
    const users = await this.userModel.find().exec();
    return users.map((user) => UserPersistenceMapper.toView(user));
  }

  async create(data: CreateUserData): Promise<UserView> {
    const user = await this.userModel.create(
      UserPersistenceMapper.toCreatePersistence(data),
    );
    return UserPersistenceMapper.toView(user);
  }

  async update(
    firebaseUid: string,
    data: UpdateUserData,
  ): Promise<WriteResult> {
    return this.userModel.updateOne(
      { firebaseUid },
      { $set: UserPersistenceMapper.toUpdatePersistence(data) },
    );
  }

  async delete(firebaseUid: string): Promise<WriteResult> {
    return this.userModel.deleteOne({ firebaseUid });
  }

  async addCakeLike(firebaseUid: string, cakeId: string): Promise<void> {
    await this.userModel.updateOne(
      { firebaseUid },
      { $addToSet: { cake_like_ids: [cakeId] } },
    );
  }

  async removeCakeLike(firebaseUid: string, cakeId: string): Promise<void> {
    await this.userModel.updateOne(
      { firebaseUid },
      { $pull: { cake_like_ids: cakeId } },
    );
  }

  async addStoreLike(firebaseUid: string, storeId: string): Promise<void> {
    await this.userModel.updateOne(
      { firebaseUid },
      { $addToSet: { store_like_ids: [storeId] } },
    );
  }

  async removeStoreLike(firebaseUid: string, storeId: string): Promise<void> {
    await this.userModel.updateOne(
      { firebaseUid },
      { $pull: { store_like_ids: storeId } },
    );
  }
}
