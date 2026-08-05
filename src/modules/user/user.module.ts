import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserRepositoryModule } from './user-repository.module';
import { UserLikeRepositoryAdapter } from './user-like.adapter';
import { UserLikePort } from './user-like.port';
import { FirebaseIdentityModule } from 'src/platform/auth/infrastructure/firebase/firebase-identity.module';

@Module({
  imports: [UserRepositoryModule, FirebaseIdentityModule],
  controllers: [UserController],
  providers: [
    UserService,
    UserLikeRepositoryAdapter,
    { provide: UserLikePort, useExisting: UserLikeRepositoryAdapter },
  ],
  exports: [UserService, UserLikePort],
})
export class UserModule {}
