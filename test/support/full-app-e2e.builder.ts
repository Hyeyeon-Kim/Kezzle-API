import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { FirebaseTokenVerifier } from 'src/platform/auth/application/firebase-token-verifier.port';
import { FirebaseAppProvider } from 'src/platform/auth/infrastructure/firebase/firebase-app.provider';
import {
  FIREBASE_APP,
  FIREBASE_AUTH_CLIENT,
} from 'src/platform/auth/infrastructure/firebase/firebase.constants';
import aiConfig from 'src/platform/config/ai.config';
import appConfig from 'src/platform/config/app.config';
import authConfig from 'src/platform/config/auth.config';
import curationConfig from 'src/platform/config/curation.config';
import databaseConfig from 'src/platform/config/database.config';
import firebaseConfig from 'src/platform/config/firebase.config';
import homeConfig from 'src/platform/config/home.config';
import rankingConfig from 'src/platform/config/ranking.config';
import storageConfig from 'src/platform/config/storage.config';
import { ObjectStoragePort } from 'src/integrations/media/application/object-storage.port';
import {
  S3_CLIENT,
  S3Client,
} from 'src/integrations/media/infrastructure/s3-object-storage.adapter';
import {
  S3_STORAGE_CONFIG,
  S3StorageConfig,
} from 'src/integrations/media/infrastructure/s3-storage.config';
import {
  aiConfigFixture,
  authConfigFixture,
  homeConfigFixture,
  rankingConfigFixture,
} from './typed-config.fixtures';

export interface FullAppE2eOptions {
  readonly mongoUri: string;
  readonly databaseName: string;
}

export interface FullAppE2eFakes {
  readonly firebaseApp: { readonly name: string };
  readonly firebaseAppProvider: {
    readonly app: { readonly name: string };
    readonly onApplicationShutdown: jest.Mock<Promise<void>, []>;
  };
  readonly firebaseAuthClient: { readonly verifyIdToken: jest.Mock };
  readonly firebaseVerifier: { readonly verify: jest.Mock };
  readonly s3Client: S3Client;
  readonly objectStorage: ObjectStoragePort;
  readonly storageConfig: S3StorageConfig;
}

export interface FullAppE2eComposition {
  readonly builder: TestingModuleBuilder;
  readonly fakes: FullAppE2eFakes;
}

export function createFullAppE2eBuilder(
  options: FullAppE2eOptions,
): FullAppE2eComposition {
  const firebaseApp = { name: 'full-app-e2e' };
  const firebaseAppProvider = {
    app: firebaseApp,
    onApplicationShutdown: jest.fn().mockResolvedValue(undefined),
  };
  const firebaseAuthClient = { verifyIdToken: jest.fn() };
  const firebaseVerifier = { verify: jest.fn() };
  const s3Client: S3Client = {
    upload: jest.fn(),
    deleteObject: jest.fn(),
  };
  const objectStorage: ObjectStoragePort = {
    put: jest.fn(),
    delete: jest.fn(),
  };
  const typedStorageConfig: S3StorageConfig = Object.freeze({
    bucket: 'full-app-e2e-bucket',
    region: 'ap-northeast-2',
    accessKeyId: 'not-a-real-access-key',
    secretAccessKey: 'not-a-real-secret-key',
  });

  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(appConfig.KEY)
    .useValue({ nodeEnv: 'test', port: 3000, shutdownDrainMs: 0 })
    .overrideProvider(authConfig.KEY)
    .useValue(authConfigFixture)
    .overrideProvider(databaseConfig.KEY)
    .useValue({
      uri: options.mongoUri,
      dbName: options.databaseName,
      username: undefined,
      password: undefined,
    })
    .overrideProvider(firebaseConfig.KEY)
    .useValue({
      projectId: 'full-app-e2e',
      privateKey: 'not-a-real-private-key',
      clientEmail: 'firebase-e2e@example.com',
    })
    .overrideProvider(storageConfig.KEY)
    .useValue(typedStorageConfig)
    .overrideProvider(aiConfig.KEY)
    .useValue(aiConfigFixture)
    .overrideProvider(homeConfig.KEY)
    .useValue(homeConfigFixture)
    .overrideProvider(rankingConfig.KEY)
    .useValue(rankingConfigFixture)
    .overrideProvider(curationConfig.KEY)
    .useValue({
      refreshEnabled: false,
      refreshIntervalMs: 600_000,
      staleMs: 259_200_000,
    })
    .overrideProvider(FirebaseAppProvider)
    .useValue(firebaseAppProvider)
    .overrideProvider(FIREBASE_APP)
    .useValue(firebaseApp)
    .overrideProvider(FIREBASE_AUTH_CLIENT)
    .useValue(firebaseAuthClient)
    .overrideProvider(FirebaseTokenVerifier)
    .useValue(firebaseVerifier)
    .overrideProvider(S3_STORAGE_CONFIG)
    .useValue(typedStorageConfig)
    .overrideProvider(S3_CLIENT)
    .useValue(s3Client)
    .overrideProvider(ObjectStoragePort)
    .useValue(objectStorage);

  return {
    builder,
    fakes: {
      firebaseApp,
      firebaseAppProvider,
      firebaseAuthClient,
      firebaseVerifier,
      s3Client,
      objectStorage,
      storageConfig: typedStorageConfig,
    },
  };
}
