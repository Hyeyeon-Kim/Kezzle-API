import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { HydratedDocument, Model } from 'mongoose';
import { User } from './entities/user.schema';
import { UserNotFoundException } from './exceptions/user-not-found';

@Injectable()
export class UserRepository {
  constructor(
    @InjectModel(User.name, 'kezzle')
    private readonly userModel: Model<User>,
  ) {}

  async findByFirebaseUidOrThrow(
    firebaseUid: string,
  ): Promise<HydratedDocument<User>> {
    let user: HydratedDocument<User> | null;
    try {
      user = await this.userModel.findOne({ firebaseUid });
    } catch {
      throw new UserNotFoundException(firebaseUid);
    }
    if (!user) {
      throw new UserNotFoundException(firebaseUid);
    }
    return user;
  }

  async addCakeLike(firebaseUid: string, cakeId: string) {
    return this.userModel.updateOne(
      { firebaseUid },
      { $addToSet: { cake_like_ids: [cakeId] } },
    );
  }

  async removeCakeLike(firebaseUid: string, cakeId: string) {
    return this.userModel.updateOne(
      { firebaseUid },
      { $pull: { cake_like_ids: cakeId } },
    );
  }

  async addStoreLike(firebaseUid: string, storeId: string) {
    return this.userModel.updateOne(
      { firebaseUid },
      { $addToSet: { store_like_ids: [storeId] } },
    );
  }

  async removeStoreLike(firebaseUid: string, storeId: string) {
    return this.userModel.updateOne(
      { firebaseUid },
      { $pull: { store_like_ids: storeId } },
    );
  }
}
