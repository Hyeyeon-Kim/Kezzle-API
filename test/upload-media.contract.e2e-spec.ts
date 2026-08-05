import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { TestingModule } from '@nestjs/testing';
import { Connection } from 'mongoose';
import request from 'supertest';
import * as XLSX from 'xlsx';
import uploadContract from './fixtures/upload-media.contract.json';
import { createFullAppE2eBuilder } from './support/full-app-e2e.builder';
import {
  ROUTE_AUTH_IDS,
  ROUTE_AUTH_PRINCIPALS,
  seedRouteAuthMatrix,
} from './support/route-auth-matrix.fixtures';

jest.setTimeout(60_000);

const imageFixtures = [
  {
    name: 'JPEG',
    filename: 'cake.jpg',
    contentType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  },
  {
    name: 'PNG',
    filename: 'cake.png',
    contentType: 'image/png',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  },
  {
    name: 'WebP',
    filename: 'cake.webp',
    contentType: 'image/webp',
    buffer: Buffer.from('RIFF0000WEBPVP8 ', 'ascii'),
  },
] as const;

function createXlsx(imageName = 'cake.png'): Buffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([
      {
        img: imageName,
        fav: '0',
        hash: '#초코',
        content: 'MIME 시그니처 정상 업로드',
      },
    ]),
    'cakes',
  );
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function createEmptyZip(entryName: string): Buffer {
  const name = Buffer.from(entryName, 'utf8');
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(name.length, 26);

  const centralDirectory = Buffer.alloc(46);
  centralDirectory.writeUInt32LE(0x02014b50, 0);
  centralDirectory.writeUInt16LE(20, 4);
  centralDirectory.writeUInt16LE(20, 6);
  centralDirectory.writeUInt16LE(name.length, 28);

  const centralDirectoryOffset = localHeader.length + name.length;
  const centralDirectorySize = centralDirectory.length + name.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralDirectorySize, 12);
  end.writeUInt32LE(centralDirectoryOffset, 16);

  return Buffer.concat([localHeader, name, centralDirectory, name, end]);
}

describe('Upload MIME and signature HTTP contract (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let connection: Connection;
  let objectStoragePut: jest.Mock;
  let objectStorageDelete: jest.Mock;

  const authorization = `Bearer ${ROUTE_AUTH_PRINCIPALS.sellerOwner.token}`;
  const cakePath = `/cakes/${ROUTE_AUTH_IDS.cakeId}`;
  const importPath = `/stores/${ROUTE_AUTH_IDS.storeId}/cakes`;

  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_URL;
    if (!mongoUri) {
      throw new Error('MONGODB_URL is required for the upload media e2e');
    }

    const composition = createFullAppE2eBuilder({
      mongoUri,
      databaseName: `kezzle_upload_media_${process.pid}`,
    });
    module = await composition.builder.compile();
    app = module.createNestApplication();
    await app.init();

    connection = module.get<Connection>(getConnectionToken('kezzle'));
    await connection.collection('stores').createIndex({ location: '2dsphere' });
    await seedRouteAuthMatrix(connection);

    composition.fakes.firebaseVerifier.verify.mockImplementation(
      async (token: string) => {
        if (token !== ROUTE_AUTH_PRINCIPALS.sellerOwner.token) {
          throw new Error(`Unknown fake Firebase token: ${token}`);
        }
        return {
          uid: ROUTE_AUTH_IDS.sellerOwnerId,
          signInProvider: 'upload-media-contract',
        };
      },
    );
    objectStoragePut = composition.fakes.objectStorage.put as jest.Mock;
    objectStorageDelete = composition.fakes.objectStorage.delete as jest.Mock;
    objectStoragePut.mockImplementation(async ({ key }: { key: string }) => ({
      key,
      url: `https://upload-media.invalid/${key}`,
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
    ['cake image', 'patch', cakePath, 'file', 'cake.svg', 'image/svg+xml'],
    [
      'store logo',
      'patch',
      `/stores/${ROUTE_AUTH_IDS.storeId}/uploads/logo`,
      'file',
      'logo.svg',
      'image/svg+xml',
    ],
    [
      'store detail image',
      'patch',
      `/stores/${ROUTE_AUTH_IDS.storeId}/uploads/storeimage`,
      'file',
      'detail.html',
      'text/html',
    ],
    [
      'cake-import image',
      'post',
      importPath,
      'image',
      'cake.svg',
      'image/svg+xml',
    ],
    [
      'cake-import Excel',
      'post',
      importPath,
      'excel',
      'cakes.xls',
      'application/vnd.ms-excel',
    ],
  ] as const)(
    'rejects an allowlist-excluded MIME on %s as 415',
    async (_name, method, path, field, filename, contentType) => {
      const httpRequest =
        method === 'patch'
          ? request(app.getHttpServer()).patch(path)
          : request(app.getHttpServer()).post(path);
      const response = await httpRequest
        .set('Authorization', authorization)
        .attach(field, Buffer.from('<html></html>'), {
          filename,
          contentType,
        });

      expect(response.status).toBe(uploadContract.unsupportedMime.status);
      expect(response.body).toEqual(uploadContract.unsupportedMime.body);
      expect(objectStoragePut).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'HTML disguised as PNG',
      'cake.png',
      'image/png',
      Buffer.from('<html></html>'),
    ],
    [
      'PNG bytes with a JPEG extension',
      'cake.jpg',
      'image/png',
      imageFixtures[1].buffer,
    ],
    [
      'PNG bytes with a JPEG MIME',
      'cake.jpg',
      'image/jpeg',
      imageFixtures[1].buffer,
    ],
  ] as const)(
    'rejects %s before S3 as 415',
    async (_name, filename, contentType, buffer) => {
      const response = await request(app.getHttpServer())
        .patch(cakePath)
        .set('Authorization', authorization)
        .attach('file', buffer, { filename, contentType });

      expect(response.status).toBe(uploadContract.signatureMismatch.status);
      expect(response.body).toEqual(uploadContract.signatureMismatch.body);
      expect(objectStoragePut).not.toHaveBeenCalled();
    },
  );

  it('rejects a non-ZIP payload disguised as XLSX before parsing', async () => {
    const response = await request(app.getHttpServer())
      .post(importPath)
      .set('Authorization', authorization)
      .attach('excel', Buffer.from('<html></html>'), {
        filename: 'cakes.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

    expect(response.status).toBe(uploadContract.signatureMismatch.status);
    expect(response.body).toEqual(uploadContract.signatureMismatch.body);
    expect(objectStoragePut).not.toHaveBeenCalled();
  });

  it('rejects an arbitrary ZIP disguised as XLSX before parsing', async () => {
    const response = await request(app.getHttpServer())
      .post(importPath)
      .set('Authorization', authorization)
      .attach('excel', createEmptyZip('notes.txt'), {
        filename: 'cakes.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

    expect(response.status).toBe(uploadContract.signatureMismatch.status);
    expect(response.body).toEqual(uploadContract.signatureMismatch.body);
    expect(objectStoragePut).not.toHaveBeenCalled();
  });

  it.each(imageFixtures)(
    'accepts a signature-matching $name and sends canonical ContentType to S3',
    async ({ filename, contentType, buffer }) => {
      const response = await request(app.getHttpServer())
        .patch(cakePath)
        .set('Authorization', authorization)
        .attach('file', buffer, { filename, contentType });

      expect(response.status).toBe(uploadContract.success.singleImageStatus);
      expect(objectStoragePut).toHaveBeenCalledWith(
        expect.objectContaining({ body: buffer, contentType }),
      );
    },
  );

  it('accepts signature-matching PNG and XLSX cake-import files', async () => {
    const image = imageFixtures[1];
    const response = await request(app.getHttpServer())
      .post(importPath)
      .set('Authorization', authorization)
      .attach('image', image.buffer, {
        filename: image.filename,
        contentType: image.contentType,
      })
      .attach('excel', createXlsx(image.filename), {
        filename: 'cakes.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

    expect(response.status).toBe(uploadContract.success.cakeImportStatus);
    expect(response.text).toBe(uploadContract.success.cakeImportBody);
    expect(objectStoragePut).toHaveBeenCalledWith(
      expect.objectContaining({
        body: image.buffer,
        contentType: image.contentType,
      }),
    );
  });
});
