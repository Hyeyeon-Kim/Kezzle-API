import { Module } from '@nestjs/common';
import { UserService } from 'src/user/application/user.service';
import { UserController } from 'src/user/api/user.controller';
import { UserRepositoryModule } from 'src/user/infrastructure/persistence/user-repository.module';
import { UserLikeRepositoryAdapter } from 'src/user/infrastructure/integration/like/user-like.adapter';
import { UserLikePort } from 'src/user/application/port/user-like.port';
import { FirebaseIdentityModule } from 'src/auth/infrastructure/firebase/firebase-identity.module';

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
