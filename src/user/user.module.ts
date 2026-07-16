import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User, UserSchema } from './entities/user.schema';
import { UserRepositoryModule } from './user-repository.module';
import { UserLikeRepositoryAdapter } from './user-like.adapter';
import { UserLikePort } from './user-like.port';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: User.name, schema: UserSchema }],
      'kezzle',
    ),
    UserRepositoryModule,
  ],
  controllers: [UserController],
  providers: [
    UserService,
    UserLikeRepositoryAdapter,
    { provide: UserLikePort, useExisting: UserLikeRepositoryAdapter },
  ],
  exports: [UserService, UserRepositoryModule, UserLikePort],
})
export class UserModule {}
