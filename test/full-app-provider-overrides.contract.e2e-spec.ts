import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import request from 'supertest';
import { FirebaseTokenVerifier } from 'src/auth/application/firebase-token-verifier.port';
import { FirebaseAppProvider } from 'src/auth/infrastructure/firebase/firebase-app.provider';
import {
  FIREBASE_APP,
  FIREBASE_AUTH_CLIENT,
} from 'src/auth/infrastructure/firebase/firebase.constants';
import { ObjectStoragePort } from 'src/media/application/object-storage.port';
import { S3_CLIENT } from 'src/media/infrastructure/s3-object-storage.adapter';
import { S3_STORAGE_CONFIG } from 'src/media/infrastructure/s3-storage.config';
import { createFullAppE2eBuilder } from './support/full-app-e2e.builder';
import { configureApplication } from 'src/configure-application';
import { ReadinessState } from 'src/health/readiness-state';

jest.setTimeout(30_000);

describe('Full AppModule external provider overrides (e2e)', () => {
  it('boots with Docker Mongo and performs no Firebase or S3 operation', async () => {
    const mongoUri = process.env.MONGODB_URL;
    if (!mongoUri) {
      throw new Error(
        'MONGODB_URL is required for the Docker full-app e2e contract',
      );
    }

    const databaseName = `kezzle_full_app_e2e_${process.pid}`;
    const { builder, fakes } = createFullAppE2eBuilder({
      mongoUri,
      databaseName,
    });
    let module: TestingModule | undefined;
    let app: INestApplication | undefined;
    let connection: Connection | undefined;
    let readiness: ReadinessState | undefined;

    try {
      module = await builder.compile();
      app = configureApplication(module.createNestApplication());
      await app.init();
      connection = module.get<Connection>(getConnectionToken('kezzle'));
      readiness = module.get(ReadinessState);

      expect(connection.readyState).toBe(1);
      expect(module.get(FirebaseAppProvider)).toBe(fakes.firebaseAppProvider);
      expect(module.get(FIREBASE_APP)).toBe(fakes.firebaseApp);
      expect(module.get(FIREBASE_AUTH_CLIENT)).toBe(fakes.firebaseAuthClient);
      expect(module.get(FirebaseTokenVerifier)).toBe(fakes.firebaseVerifier);
      expect(module.get(S3_STORAGE_CONFIG)).toBe(fakes.storageConfig);
      expect(module.get(S3_CLIENT)).toBe(fakes.s3Client);
      expect(module.get(ObjectStoragePort)).toBe(fakes.objectStorage);

      await request(app.getHttpServer())
        .get('/health/live')
        .expect(200)
        .expect({ status: 'ok' });
      await request(app.getHttpServer()).get('/health/ready').expect(503);

      readiness.markReady();
      await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200)
        .expect({
          status: 'ok',
          checks: {
            lifecycle: 'ready',
            mongo: 'up',
            redis: 'disabled',
          },
        });

      const swaggerResponse = await request(app.getHttpServer()).get(
        '/api-docs',
      );
      expect(swaggerResponse.status).toBeLessThan(400);

      await request(app.getHttpServer())
        .get('/metrics')
        .expect(200)
        .expect(({ text }) => {
          expect(text).toContain('object_storage_operation_failures_total');
          expect(text).toContain('media_object_orphans_total');
        });

      expect(fakes.firebaseAuthClient.verifyIdToken).not.toHaveBeenCalled();
      expect(fakes.firebaseVerifier.verify).not.toHaveBeenCalled();
      expect(fakes.s3Client.upload).not.toHaveBeenCalled();
      expect(fakes.s3Client.deleteObject).not.toHaveBeenCalled();
      expect(fakes.objectStorage.put).not.toHaveBeenCalled();
      expect(fakes.objectStorage.delete).not.toHaveBeenCalled();
      expect(
        fakes.firebaseAppProvider.onApplicationShutdown,
      ).not.toHaveBeenCalled();
    } finally {
      if (connection?.readyState === 1) await connection.dropDatabase();
      if (app) await app.close();
      else if (module) await module.close();
    }

    expect(
      fakes.firebaseAppProvider.onApplicationShutdown,
    ).toHaveBeenCalledTimes(1);
    expect(readiness?.current).toBe('shutting-down');
    expect(connection?.readyState).toBe(0);
  });
});
