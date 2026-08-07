import { UserModule } from 'src/modules/user/user.module';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PassportModule } from '@nestjs/passport';

import { FirebaseAuthStrategy } from './strategies/firebase-auth.strategy';
import { ConfigModule } from '@nestjs/config';
import authConfig from 'src/platform/config/auth.config';
import { FirebaseIdentityModule } from './infrastructure/firebase/firebase-identity.module';
@Module({
  imports: [
    ConfigModule.forFeature(authConfig),
    FirebaseIdentityModule,
    UserModule,
    PassportModule,
    HttpModule,
  ],
  controllers: [],
  providers: [FirebaseAuthStrategy],
})
export class AuthModule {}
