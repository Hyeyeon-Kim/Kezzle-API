import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { App, cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from 'src/config/firebase.config';
import { FIREBASE_APP, FIREBASE_AUTH_CLIENT } from './firebase.constants';

const FIREBASE_APP_NAME = 'kezzle-api';

@Injectable()
export class FirebaseAppProvider implements OnApplicationShutdown {
  readonly app: App;
  private deleted = false;

  constructor(
    @Inject(firebaseConfig.KEY)
    config: ConfigType<typeof firebaseConfig>,
  ) {
    this.app = initializeApp(
      {
        credential: cert({
          projectId: config.projectId,
          privateKey: config.privateKey,
          clientEmail: config.clientEmail,
        }),
      },
      FIREBASE_APP_NAME,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.deleted) return;
    this.deleted = true;
    await deleteApp(this.app);
  }
}

export const firebaseAppTokenProvider = {
  provide: FIREBASE_APP,
  inject: [FirebaseAppProvider],
  useFactory: (provider: FirebaseAppProvider) => provider.app,
};

export const firebaseAuthClientProvider = {
  provide: FIREBASE_AUTH_CLIENT,
  inject: [FIREBASE_APP],
  useFactory: getAuth,
};
