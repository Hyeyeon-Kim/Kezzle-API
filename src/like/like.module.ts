import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LikeService } from './like.service';
import { LikeController } from './like.controller';
import { User, UserSchema } from 'src/user/entities/user.schema';
import { CakeModule } from './../cake/cake.module';
import { UserModule } from 'src/user/user.module';
import { StoreModule } from 'src/store/store.module';
import { LogModule } from 'src/log/log.module';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: User.name, schema: UserSchema }],
      'kezzle',
    ),
    CakeModule,
    UserModule,
    StoreModule,
    LogModule,
  ],
  providers: [LikeService],
  controllers: [LikeController],
})
export class LikeModule {}
