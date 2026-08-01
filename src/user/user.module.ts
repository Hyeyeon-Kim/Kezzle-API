import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRepositoryModule } from './user-repository.module';
import { UserLikeRepositoryAdapter } from './user-like.adapter';
import { UserLikePort } from './user-like.port';

@Module({
  imports: [UserRepositoryModule],
  controllers: [UserController],
  providers: [
    UserService,
    UserLikeRepositoryAdapter,
    { provide: UserLikePort, useExisting: UserLikeRepositoryAdapter },
  ],
  exports: [UserService, UserLikePort],
})
export class UserModule {}
