import { Module } from '@nestjs/common';
import { LikeService } from './like.service';
import { LikeController } from './like.controller';
import { CakeRepositoryModule } from 'src/cake/cake-repository.module';
import { UserRepositoryModule } from 'src/user/user-repository.module';
import { StoreRepositoryModule } from 'src/store/store-repository.module';
import { LogModule } from 'src/log/log.module';

@Module({
  imports: [
    CakeRepositoryModule,
    UserRepositoryModule,
    StoreRepositoryModule,
    LogModule,
  ],
  providers: [LikeService],
  controllers: [LikeController],
})
export class LikeModule {}
