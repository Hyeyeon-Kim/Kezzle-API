import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  User,
  UserSchema,
} from 'src/modules/user/infrastructure/persistence/schema/user.schema';
import { UserRepository } from './user.repository';
import { UserRepositoryPort } from 'src/modules/user/application/port/user-repository.port';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: User.name, schema: UserSchema }],
      'kezzle',
    ),
  ],
  providers: [
    UserRepository,
    { provide: UserRepositoryPort, useExisting: UserRepository },
  ],
  exports: [UserRepository, UserRepositoryPort],
})
export class UserRepositoryModule {}
