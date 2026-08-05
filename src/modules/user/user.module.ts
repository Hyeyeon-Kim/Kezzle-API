import { Module } from '@nestjs/common';
import { UserService } from './application/user.service';
import { UserController } from './api/user.controller';
import { UserRepositoryModule } from './infrastructure/persistence/user-repository.module';
import { UserLikeRepositoryAdapter } from './infrastructure/user-like.adapter';
import { UserLikePort } from './application/user-like.port';
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
