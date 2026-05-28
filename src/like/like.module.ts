import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LikeService } from './like.service';
import { LikeController } from './like.controller';
import { User, UserSchema } from 'src/user/entities/user.schema';
import { CakeRepositoryModule } from 'src/cake/cake-repository.module';
import { UserModule } from 'src/user/user.module';
import { StoreRepositoryModule } from 'src/store/store-repository.module';
import { LogModule } from 'src/log/log.module';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: User.name, schema: UserSchema }],
      'kezzle',
    ),
    CakeRepositoryModule,
    UserModule,
    StoreRepositoryModule,
    LogModule,
  ],
  providers: [LikeService],
  controllers: [LikeController],
})
export class LikeModule {}
