import { UserModule } from 'src/user/user.module';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PassportModule } from '@nestjs/passport';

import { FirebaseAuthStrategy } from './stategies/firebase-auth.stategies';
import { ConfigModule } from '@nestjs/config';
import authConfig from 'src/config/auth.config';
@Module({
  imports: [
    ConfigModule.forFeature(authConfig),
    UserModule,
    PassportModule,
    HttpModule,
  ],
  controllers: [],
  providers: [FirebaseAuthStrategy],
})
export class AuthModule {}
