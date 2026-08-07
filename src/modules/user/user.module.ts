import { Module } from '@nestjs/common';
import { UserService } from 'src/modules/user/application/user.service';
import { UserController } from 'src/modules/user/api/user.controller';
import { UserRepositoryModule } from 'src/modules/user/infrastructure/persistence/user-repository.module';
import { UserLikeRepositoryAdapter } from 'src/modules/user/infrastructure/integration/like/user-like.adapter';
import { UserLikePort } from 'src/modules/user/application/port/user-like.port';
import { FirebaseIdentityModule } from 'src/platform/auth/infrastructure/firebase/firebase-identity.module';
import { AuthenticatedUserReader } from 'src/platform/auth/application/authenticated-user.reader';

@Module({
  imports: [UserRepositoryModule, FirebaseIdentityModule],
  controllers: [UserController],
  providers: [
    UserService,
    { provide: AuthenticatedUserReader, useExisting: UserService },
    UserLikeRepositoryAdapter,
    { provide: UserLikePort, useExisting: UserLikeRepositoryAdapter },
  ],
  exports: [AuthenticatedUserReader, UserLikePort],
})
export class UserModule {}
