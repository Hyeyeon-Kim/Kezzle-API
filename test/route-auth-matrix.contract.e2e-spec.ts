import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { TestingModule } from '@nestjs/testing';
import { Connection } from 'mongoose';
import request from 'supertest';
import * as XLSX from 'xlsx';
import { ClipClient } from 'src/ai-search/clip-client';
import { VitClient } from 'src/ai-search/vit-client';
import { ReadinessState } from 'src/health/readiness-state';
import routeAuthMatrixJson from './fixtures/route-auth-matrix.contract.json';
import { createFullAppE2eBuilder } from './support/full-app-e2e.builder';
import {
  PrincipalName,
  ROUTE_AUTH_IDS,
  ROUTE_AUTH_PRINCIPALS,
  ROUTE_AUTH_PRINCIPAL_ORDER,
  seedRouteAuthMatrix,
} from './support/route-auth-matrix.fixtures';

type ExpectedAuthOutcome = 'allow' | 401 | 403;
type RequestProfile =
  | 'register-user'
  | 'update-user'
  | 'page'
  | 'geo-page'
  | 'similar'
  | 'image-upload'
  | 'cake-import'
  | 'create-store'
  | 'update-store'
  | 'image-index'
  | 'rank'
  | 'create-curation';

interface RouteAuthMatrixEntry {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly requestPath?: string;
  readonly requestProfile?: RequestProfile;
  readonly policy: string;
  readonly principals: Record<PrincipalName, ExpectedAuthOutcome>;
}

interface ExpressRouteLayer {
  readonly route?: {
    readonly path: string;
    readonly methods: Record<string, boolean>;
  };
}

const routeAuthMatrix = routeAuthMatrixJson as RouteAuthMatrixEntry[];
const allowedStatuses = (status: number): boolean =>
  (status >= 200 && status < 300) || status === 404;

function routeKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

function requestPath(entry: RouteAuthMatrixEntry): string {
  return Object.entries(ROUTE_AUTH_IDS).reduce(
    (path, [name, value]) => path.replaceAll(`{${name}}`, value),
    entry.requestPath ?? entry.path,
  );
}

function registeredControllerRoutes(app: INestApplication): string[] {
  const express = app.getHttpAdapter().getInstance() as {
    _router?: { readonly stack: ExpressRouteLayer[] };
  };
  const stack = express._router?.stack ?? [];

  return stack
    .flatMap((layer) => {
      if (!layer.route || typeof layer.route.path !== 'string') return [];
      return Object.entries(layer.route.methods)
        .filter(([, enabled]) => enabled)
        .map(([method]) => routeKey(method, layer.route.path));
    })
    .sort();
}

function principalToken(principal: PrincipalName): string | undefined {
  if (principal === 'anonymous') return undefined;
  return ROUTE_AUTH_PRINCIPALS[principal].token;
}

function createXlsxBuffer(): Buffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['img', 'fav', 'hash', 'content'],
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'cakes');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

jest.setTimeout(60_000);

describe('Route authorization matrix contract (e2e)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let connection: Connection;
  let fakes: ReturnType<typeof createFullAppE2eBuilder>['fakes'];

  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_URL;
    if (!mongoUri) {
      throw new Error('MONGODB_URL is required for the route auth matrix e2e');
    }

    const composition = createFullAppE2eBuilder({
      mongoUri,
      databaseName: `kezzle_route_auth_matrix_${process.pid}`,
    });
    fakes = composition.fakes;

    const clipClient = {
      koSearch: jest.fn().mockResolvedValue([]),
      koSearchPage: jest.fn().mockResolvedValue({
        result: [],
        nextPage: undefined,
        isLastPage: true,
      }),
    };
    const vitClient = {
      similarSearch: jest.fn().mockResolvedValue([]),
      similarSearchWithLocation: jest.fn().mockResolvedValue([]),
    };

    module = await composition.builder
      .overrideProvider(ClipClient)
      .useValue(clipClient)
      .overrideProvider(VitClient)
      .useValue(vitClient)
      .compile();
    app = module.createNestApplication();
    await app.init();

    connection = module.get<Connection>(getConnectionToken('kezzle'));
    await connection.collection('stores').createIndex({ location: '2dsphere' });
    await seedRouteAuthMatrix(connection);
    module.get(ReadinessState).markReady();

    fakes.firebaseVerifier.verify.mockImplementation(async (token: string) => {
      if (token.startsWith('auth-matrix-registration-')) {
        return { uid: token, signInProvider: 'route-auth-matrix' };
      }

      const principal = Object.values(ROUTE_AUTH_PRINCIPALS).find(
        (candidate) => candidate.token === token,
      );
      if (!principal) throw new Error(`Unknown fake Firebase token: ${token}`);
      return {
        uid: principal.firebaseUid,
        signInProvider: 'route-auth-matrix',
      };
    });
    (fakes.objectStorage.put as jest.Mock).mockImplementation(
      async ({ key }: { key: string }) => ({
        key,
        url: `https://auth-matrix.invalid/${key}`,
      }),
    );
    (fakes.objectStorage.delete as jest.Mock).mockResolvedValue(undefined);
  });

  afterAll(async () => {
    if (connection?.readyState === 1) await connection.dropDatabase();
    if (app) await app.close();
    else if (module) await module.close();
  });

  it('registers every controller route in the matrix exactly once', () => {
    const matrixRoutes = routeAuthMatrix
      .map((entry) => routeKey(entry.method, entry.path))
      .sort();

    expect(new Set(matrixRoutes).size).toBe(matrixRoutes.length);
    expect(matrixRoutes).toEqual(registeredControllerRoutes(app));
  });

  it.each(routeAuthMatrix)(
    '$method $path keeps the $policy policy',
    async (entry) => {
      for (const principal of ROUTE_AUTH_PRINCIPAL_ORDER) {
        const response = await executeRequest(entry, principal);
        const expected = entry.principals[principal];
        const actual: ExpectedAuthOutcome | number = allowedStatuses(
          response.status,
        )
          ? 'allow'
          : response.status;

        expect({
          route: routeKey(entry.method, entry.path),
          principal,
          status: actual,
        }).toEqual({
          route: routeKey(entry.method, entry.path),
          principal,
          status: expected,
        });
      }
    },
  );

  async function executeRequest(
    entry: RouteAuthMatrixEntry,
    principal: PrincipalName,
  ) {
    const client = request(app.getHttpServer());
    const path = requestPath(entry);
    let httpRequest: request.Test;

    switch (entry.method) {
      case 'GET':
        httpRequest = client.get(path);
        break;
      case 'POST':
        httpRequest = client.post(path);
        break;
      case 'PATCH':
        httpRequest = client.patch(path);
        break;
      case 'DELETE':
        httpRequest = client.delete(path);
        break;
    }

    const token = principalToken(principal);
    if (token) httpRequest.set('Authorization', `Bearer ${token}`);

    return applyRequestProfile(httpRequest, entry.requestProfile, principal);
  }

  function applyRequestProfile(
    httpRequest: request.Test,
    profile: RequestProfile | undefined,
    principal: PrincipalName,
  ): request.Test {
    switch (profile) {
      case 'register-user':
        return httpRequest
          .set('Authorization', `Bearer auth-matrix-registration-${principal}`)
          .send({ nickname: `registered-${principal}` });
      case 'update-user':
        return httpRequest.send({ nickname: 'updated-by-auth-matrix' });
      case 'page':
        return httpRequest.query({ page: '0', count: '1' });
      case 'geo-page':
        return httpRequest.query({
          latitude: '37.5',
          longitude: '127.0',
          dist: '1000',
          count: '1',
        });
      case 'similar':
        return httpRequest.query({
          latitude: '37.5',
          longitude: '127.0',
          dist: '1000',
          size: '1',
        });
      case 'image-upload':
        return httpRequest.attach(
          'file',
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
          {
            filename: 'auth-matrix.png',
            contentType: 'image/png',
          },
        );
      case 'cake-import':
        return httpRequest.attach('excel', createXlsxBuffer(), {
          filename: 'auth-matrix.xlsx',
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
      case 'create-store':
        return httpRequest.send({
          name: '권한 매트릭스 신규 매장',
          location: { latitude: 37.5, longitude: 127.0 },
          address: '서울시 테스트구',
          owner_user_id: ROUTE_AUTH_IDS.sellerOwnerId,
          operating_time: [],
          taste: ['초코'],
        });
      case 'update-store':
        return httpRequest.send({ taste: ['초코', '딸기'] });
      case 'image-index':
        return httpRequest.query({ index: '0' });
      case 'rank':
        return httpRequest.query({
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          after: '0',
          limit: '1',
        });
      case 'create-curation':
        return httpRequest.query({
          keyword: '케이크',
          disc: '권한 매트릭스 큐레이션',
          note: '테스트',
        });
      default:
        return httpRequest;
    }
  }
});
