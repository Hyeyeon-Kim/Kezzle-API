import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CakeController } from 'src/modules/cake/cake.controller';
import { CakeService } from 'src/modules/cake/cake.service';
import { CakeMediaService } from 'src/modules/cake/cake-media.service';
import { CakeImportService } from 'src/modules/cake/cake-import.service';
import { CurationController } from 'src/modules/curation/curation.controller';
import { CurationService } from 'src/modules/curation/curation.service';
import { createValidationPipe } from 'src/app.validation';
import { IS_PUBLIC_KEY } from 'src/platform/auth/decorators/public.decorator';
import { RolesGuard } from 'src/platform/auth/guard/roles.guard';
import { StoreController } from 'src/modules/store/store.controller';
import { StoreService } from 'src/modules/store/store.service';
import { StoreMediaService } from 'src/modules/store/store-media.service';
import { Roles } from 'src/modules/user/entities/roles.enum';
import { UserController } from 'src/modules/user/user.controller';
import { UserService } from 'src/modules/user/user.service';
import fixtures from './fixtures/type-boundary-write.contract.json';

@Injectable()
class ContractAuthenticationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    const [role, firebaseUid] = authorization
      .slice('Bearer '.length)
      .split(':');
    const rolesByToken = {
      admin: Roles.ADMIN,
      buyer: Roles.BUYER,
      seller: Roles.SELLER,
    } as const;
    const resolvedRole = rolesByToken[role];
    if (!resolvedRole || !firebaseUid) {
      throw new UnauthorizedException();
    }

    request.user = {
      firebaseUid,
      nickname: `contract-${role}`,
      oauthProvider: 'contract',
      roles: [resolvedRole],
      cakeLikeIds: [],
      storeLikeIds: [],
    };
    return true;
  }
}

describe('Type boundary write HTTP contract', () => {
  let app: INestApplication;

  const cakeService = {};
  const cakeMediaService = {
    replaceImage: jest.fn(),
    softDelete: jest.fn(),
  };
  const cakeImportService = { import: jest.fn() };
  const storeService = { create: jest.fn() };
  const storeMediaService = {
    replaceLogo: jest.fn(),
    addDetailImage: jest.fn(),
    removeDetailImage: jest.fn(),
  };
  const userService = { create: jest.fn() };
  const curationService = { createCuration: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        CakeController,
        StoreController,
        UserController,
        CurationController,
      ],
      providers: [
        { provide: CakeService, useValue: cakeService },
        { provide: CakeMediaService, useValue: cakeMediaService },
        { provide: CakeImportService, useValue: cakeImportService },
        { provide: StoreService, useValue: storeService },
        { provide: StoreMediaService, useValue: storeMediaService },
        { provide: UserService, useValue: userService },
        { provide: CurationService, useValue: curationService },
        { provide: APP_GUARD, useClass: ContractAuthenticationGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    cakeImportService.import.mockResolvedValue(fixtures.cakeCreate);
    cakeMediaService.replaceImage.mockResolvedValue({ acknowledged: true });
    cakeMediaService.softDelete.mockResolvedValue({ acknowledged: true });
    storeMediaService.replaceLogo.mockResolvedValue({ acknowledged: true });
    storeMediaService.addDetailImage.mockResolvedValue({ acknowledged: true });
    storeMediaService.removeDetailImage.mockResolvedValue({
      acknowledged: true,
    });
    storeService.create.mockResolvedValue({
      id: 'store-created-1',
      name: 'Created Store',
      logo: undefined,
      feature: '',
      description: '',
      instagramUrl: '',
      kakaoChannelUrl: '',
      kakaoMapUrl: '',
      location: { longitude: 127.1, latitude: 37.5 },
      address: 'Seoul',
      phoneNumber: '',
      ownerUserId: 'seller-1',
      detailImages: [],
      operatingTime: ['10:00-18:00'],
      likedUserIds: [],
      taste: ['vanilla'],
      createdAt: new Date('2026-07-16T00:00:00.000Z'),
      updatedAt: new Date('2026-07-16T00:00:00.000Z'),
    });
    userService.create.mockResolvedValue({
      id: 'user-created-1',
      firebaseUid: 'firebase-created-1',
      nickname: 'Created User',
      oauthProvider: 'password',
      roles: [Roles.BUYER],
      cakeLikeIds: [],
      storeLikeIds: [],
      createdAt: new Date('2026-07-16T00:00:00.000Z'),
      updatedAt: new Date('2026-07-16T00:00:00.000Z'),
    });
    curationService.createCuration.mockResolvedValue({
      id: 'curation-created-1',
      cakes: [
        {
          id: 'cake-created-1',
          image: {
            name: 'cake.png',
            converteName: 'cake-converted.png',
            key: 'cakes/cake-converted.png',
            s3Url: 'https://cdn.example.com/cakes/cake-converted.png',
          },
          ownerStoreId: 'store-created-1',
          cursor: 'cursor-created-1',
          tags: ['birthday'],
          likedUserIds: [],
          score: 0.9,
          extra: { legacy_extra: 'kept' },
        },
      ],
      key: 'birthday',
      description: 'Birthday curation',
      note: 'created',
      createdAt: new Date('2026-07-16T00:00:00.000Z'),
      updatedAt: new Date('2026-07-16T00:00:00.000Z'),
      version: 0,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps POST /stores/:id/cakes status, upload fields, and response', async () => {
    const response = await request(app.getHttpServer())
      .post('/stores/store-created-1/cakes')
      .set('Authorization', 'Bearer seller:seller-1')
      .attach('image', Buffer.from('image'), 'cake.png')
      .attach('excel', Buffer.from('excel'), 'cakes.xlsx')
      .expect(201);

    expect(response.text).toBe(fixtures.cakeCreate);
    expect(cakeImportService.import).toHaveBeenCalledWith(
      'store-created-1',
      expect.objectContaining({
        firebaseUid: 'seller-1',
        roles: [Roles.SELLER],
      }),
      expect.objectContaining({
        image: [
          expect.objectContaining({
            originalName: 'cake.png',
            contentType: 'image/png',
          }),
        ],
        excel: [
          expect.objectContaining({
            originalName: 'cakes.xlsx',
            contentType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
        ],
      }),
    );
  });

  it('keeps Cake media route status, response, and Multer mapping', async () => {
    await request(app.getHttpServer())
      .patch('/cakes/cake-1')
      .set('Authorization', 'Bearer seller:seller-1')
      .attach('file', Buffer.from('image'), 'cake.jpg')
      .expect(200, { acknowledged: true });

    expect(cakeMediaService.replaceImage).toHaveBeenCalledWith(
      'cake-1',
      expect.objectContaining({ firebaseUid: 'seller-1' }),
      expect.objectContaining({
        originalName: 'cake.jpg',
        contentType: 'image/jpeg',
      }),
    );

    await request(app.getHttpServer())
      .delete('/cakes/cake-1')
      .set('Authorization', 'Bearer seller:seller-1')
      .expect(200, { acknowledged: true });
    expect(cakeMediaService.softDelete).toHaveBeenCalledWith(
      'cake-1',
      expect.objectContaining({ firebaseUid: 'seller-1' }),
    );
  });

  it('keeps Store media route status, response, and input mapping', async () => {
    await request(app.getHttpServer())
      .patch('/stores/store-1/uploads/logo')
      .set('Authorization', 'Bearer seller:seller-1')
      .attach('file', Buffer.from('logo'), 'logo.png')
      .expect(200, { acknowledged: true });
    expect(storeMediaService.replaceLogo).toHaveBeenCalledWith(
      'store-1',
      expect.objectContaining({ firebaseUid: 'seller-1' }),
      expect.objectContaining({
        originalName: 'logo.png',
        contentType: 'image/png',
      }),
    );

    await request(app.getHttpServer())
      .patch('/stores/store-1/uploads/storeimage')
      .set('Authorization', 'Bearer seller:seller-1')
      .attach('file', Buffer.from('detail'), 'detail.webp')
      .expect(200, { acknowledged: true });
    expect(storeMediaService.addDetailImage).toHaveBeenCalledWith(
      'store-1',
      expect.objectContaining({ firebaseUid: 'seller-1' }),
      expect.objectContaining({
        originalName: 'detail.webp',
        contentType: 'image/webp',
      }),
    );

    await request(app.getHttpServer())
      .delete('/stores/store-1/deletes/storeimage')
      .query({ index: '1' })
      .set('Authorization', 'Bearer seller:seller-1')
      .expect(200, { acknowledged: true });
    expect(storeMediaService.removeDetailImage).toHaveBeenCalledWith(
      'store-1',
      expect.objectContaining({ firebaseUid: 'seller-1' }),
      1,
    );
  });

  it('keeps POST /stores validation, status, command mapping, and response', async () => {
    const body = {
      name: 'Created Store',
      location: { latitude: 37.5, longitude: 127.1 },
      address: 'Seoul',
      owner_user_id: 'seller-1',
      operating_time: ['10:00-18:00'],
      taste: ['vanilla'],
    };

    const response = await request(app.getHttpServer())
      .post('/stores')
      .set('Authorization', 'Bearer admin:admin-1')
      .send(body)
      .expect(201);

    expect(response.body).toEqual(fixtures.storeCreate);
    expect(storeService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Created Store',
        location: { latitude: 37.5, longitude: 127.1 },
        ownerUserId: 'seller-1',
      }),
    );

    await request(app.getHttpServer())
      .post('/stores')
      .set('Authorization', 'Bearer admin:admin-1')
      .send({ ...body, unknown: true })
      .expect(400);
  });

  it('keeps public POST /users validation, status, command, and response', async () => {
    const response = await request(app.getHttpServer())
      .post('/users')
      .send({ nickname: 'Created User' })
      .expect(201);

    expect(response.body).toEqual(fixtures.userCreate);
    expect(userService.create).toHaveBeenCalledWith({
      token: undefined,
      nickname: 'Created User',
    });

    await request(app.getHttpServer())
      .post('/users')
      .send({ nickname: 123 })
      .expect(400);
  });

  it('keeps POST /curation status, query mapping, and response fixture', async () => {
    const response = await request(app.getHttpServer())
      .post('/curation')
      .query({
        keyword: 'birthday',
        disc: 'Birthday curation',
        note: 'created',
      })
      .set('Authorization', 'Bearer admin:admin-1')
      .expect(201);

    expect(response.body).toEqual(fixtures.curationCreate);
    expect(curationService.createCuration).toHaveBeenCalledWith(
      'birthday',
      'Birthday curation',
      'created',
    );
  });
});
