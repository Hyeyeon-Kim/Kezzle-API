import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseTokenVerifier } from 'src/platform/auth/application/firebase-token-verifier.port';
import firebaseConfig from 'src/platform/config/firebase.config';
import { FirebaseAdminTokenVerifierAdapter } from './firebase-admin-token-verifier.adapter';
import {
  firebaseAppTokenProvider,
  firebaseAuthClientProvider,
  FirebaseAppProvider,
} from './firebase-app.provider';

@Module({
  imports: [ConfigModule.forFeature(firebaseConfig)],
  providers: [
    FirebaseAppProvider,
    firebaseAppTokenProvider,
    firebaseAuthClientProvider,
    FirebaseAdminTokenVerifierAdapter,
    {
      provide: FirebaseTokenVerifier,
      useExisting: FirebaseAdminTokenVerifierAdapter,
    },
  ],
  exports: [FirebaseTokenVerifier],
})
export class FirebaseIdentityModule {}
