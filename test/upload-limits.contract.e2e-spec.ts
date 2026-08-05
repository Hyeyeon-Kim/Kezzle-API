import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { TestingModule } from '@nestjs/testing';
import { Connection } from 'mongoose';
import request from 'supertest';
import * as XLSX from 'xlsx';
import { IMAGE_MAX_BYTES, EXCEL_MAX_BYTES } from 'src/media/api/upload-limits';
import uploadContract from './fixtures/upload-limits.contract.json';
import { createFullAppE2eBuilder } from './support/full-app-e2e.builder';
import {
  ROUTE_AUTH_IDS,
  ROUTE_AUTH_PRINCIPALS,
  seedRouteAuthMatrix,
} from './support/route-auth-matrix.fixtures';

jest.setTimeout(60_000);

describe('Upload size limit HTTP contract (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let connection: Connection;
  let fakes: ReturnType<typeof createFullAppE2eBuilder>['fakes'];
  let objectStoragePut: jest.Mock;
  let objectStorageDelete: jest.Mock;

  const authorization = `Bearer ${ROUTE_AUTH_PRINCIPALS.sellerOwner.token}`;
  const image = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
  ]);

  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_URL;
    if (!mongoUri) {
      throw new Error('MONGODB_URL is required for the upload limit e2e');
    }

    const composition = createFullAppE2eBuilder({
      mongoUri,
      databaseName: `kezzle_upload_limits_${process.pid}`,
    });
    fakes = composition.fakes;
    module = await composition.builder.compile();
    app = module.createNestApplication();
    await app.init();

    connection = module.get<Connection>(getConnectionToken('kezzle'));
    await connection.collection('stores').createIndex({ location: '2dsphere' });
    await seedRouteAuthMatrix(connection);

    fakes.firebaseVerifier.verify.mockImplementation(async (token: string) => {
      if (token !== ROUTE_AUTH_PRINCIPALS.sellerOwner.token) {
        throw new Error(`Unknown fake Firebase token: ${token}`);
      }
      return {
        uid: ROUTE_AUTH_IDS.sellerOwnerId,
        signInProvider: 'route-auth-matrix',
      };
    });
    objectStoragePut = fakes.objectStorage.put as jest.Mock;
    objectStorageDelete = fakes.objectStorage.delete as jest.Mock;
    objectStoragePut.mockImplementation(async ({ key }: { key: string }) => ({
      key,
      url: `https://upload-limits.invalid/${key}`,
    }));
    objectStorageDelete.mockResolvedValue(undefined);
  });

  beforeEach(() => {
    objectStoragePut.mockClear();
    objectStorageDelete.mockClear();
  });

  afterAll(async () => {
    if (connection?.readyState === 1) await connection.dropDatabase();
    if (app) await app.close();
    else if (module) await module.close();
  });

  it.each([
    ['cake image', `/cakes/${ROUTE_AUTH_IDS.cakeId}`],
    ['store logo', `/stores/${ROUTE_AUTH_IDS.storeId}/uploads/logo`],
    [
      'store detail image',
      `/stores/${ROUTE_AUTH_IDS.storeId}/uploads/storeimage`,
    ],
  ])('rejects an oversized %s before storage', async (_name, path) => {
    const response = await request(app.getHttpServer())
      .patch(path)
      .set('Authorization', authorization)
      .attach('file', Buffer.alloc(IMAGE_MAX_BYTES + 1), {
        filename: 'too-large.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(uploadContract.tooLarge.status);
    expect(response.body).toEqual(uploadContract.tooLarge.body);
    expect(objectStoragePut).not.toHaveBeenCalled();
  });

  it.each([
    ['image', 'image', 'too-large.png', 'image/png'],
    [
      'XLSX',
      'excel',
      'too-large.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  ])(
    'rejects an oversized cake-import %s before storage',
    async (_name, field, filename, contentType) => {
      const response = await request(app.getHttpServer())
        .post(`/stores/${ROUTE_AUTH_IDS.storeId}/cakes`)
        .set('Authorization', authorization)
        .attach(field, Buffer.alloc(EXCEL_MAX_BYTES + 1), {
          filename,
          contentType,
        });

      expect(response.status).toBe(uploadContract.tooLarge.status);
      expect(response.body).toEqual(uploadContract.tooLarge.body);
      expect(objectStoragePut).not.toHaveBeenCalled();
    },
  );

  it('preserves successful single-image response and S3 put contracts', async () => {
    const routes = [
      `/cakes/${ROUTE_AUTH_IDS.cakeId}`,
      `/stores/${ROUTE_AUTH_IDS.storeId}/uploads/logo`,
      `/stores/${ROUTE_AUTH_IDS.storeId}/uploads/storeimage`,
    ];

    for (const path of routes) {
      const response = await request(app.getHttpServer())
        .patch(path)
        .set('Authorization', authorization)
        .attach('file', image, {
          filename: 'within-limit.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(uploadContract.success.singleImageStatus);
      expect(Object.keys(response.body).sort()).toEqual(
        [...uploadContract.success.singleImageBodyKeys].sort(),
      );
    }

    expect(objectStoragePut).toHaveBeenCalledTimes(routes.length);
    for (const [input] of objectStoragePut.mock.calls) {
      expect(input).toEqual(
        expect.objectContaining({
          body: image,
          contentType: 'image/png',
        }),
      );
    }
  });

  it('preserves cake-import response and S3 put contracts within limits', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([
        {
          img: 'within-limit.png',
          fav: '0',
          hash: '#초코',
          content: '제한 이내 업로드',
        },
      ]),
      'cakes',
    );
    const excel = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const response = await request(app.getHttpServer())
      .post(`/stores/${ROUTE_AUTH_IDS.storeId}/cakes`)
      .set('Authorization', authorization)
      .attach('image', image, {
        filename: 'within-limit.png',
        contentType: 'image/png',
      })
      .attach('excel', excel, {
        filename: 'within-limit.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

    expect(response.status).toBe(uploadContract.success.cakeImportStatus);
    expect(response.text).toBe(uploadContract.success.cakeImportBody);
    expect(objectStoragePut).toHaveBeenCalledTimes(1);
    expect(objectStoragePut).toHaveBeenCalledWith(
      expect.objectContaining({
        body: image,
        contentType: 'image/png',
      }),
    );
  });
});
