import { Connection, Types } from 'mongoose';
import { Roles } from 'src/user/domain/roles.enum';

export const ROUTE_AUTH_IDS = Object.freeze({
  buyerSelfId: 'auth-matrix-buyer-self',
  buyerOtherId: 'auth-matrix-buyer-other',
  sellerOwnerId: 'auth-matrix-seller-owner',
  sellerOtherId: 'auth-matrix-seller-other',
  adminId: 'auth-matrix-admin',
  storeId: '66b1a0000000000000000001',
  cakeId: '66b1a0000000000000000002',
  anniversaryId: '66b1a0000000000000000003',
  curationId: '66b1a0000000000000000004',
});

export const ROUTE_AUTH_PRINCIPALS = Object.freeze({
  buyerSelf: {
    token: 'auth-matrix-buyer-self-token',
    firebaseUid: ROUTE_AUTH_IDS.buyerSelfId,
    role: Roles.BUYER,
  },
  buyerOther: {
    token: 'auth-matrix-buyer-other-token',
    firebaseUid: ROUTE_AUTH_IDS.buyerOtherId,
    role: Roles.BUYER,
  },
  sellerOwner: {
    token: 'auth-matrix-seller-owner-token',
    firebaseUid: ROUTE_AUTH_IDS.sellerOwnerId,
    role: Roles.SELLER,
  },
  sellerOther: {
    token: 'auth-matrix-seller-other-token',
    firebaseUid: ROUTE_AUTH_IDS.sellerOtherId,
    role: Roles.SELLER,
  },
  admin: {
    token: 'auth-matrix-admin-token',
    firebaseUid: ROUTE_AUTH_IDS.adminId,
    role: Roles.ADMIN,
  },
});

export type AuthenticatedPrincipalName = keyof typeof ROUTE_AUTH_PRINCIPALS;
export type PrincipalName = 'anonymous' | AuthenticatedPrincipalName;

export const ROUTE_AUTH_PRINCIPAL_ORDER: readonly PrincipalName[] = [
  'anonymous',
  'buyerSelf',
  'buyerOther',
  'sellerOther',
  'sellerOwner',
  'admin',
];

const image = (name: string, key: string) => ({
  name,
  converte_name: name,
  key,
  s3Url: `https://auth-matrix.invalid/${key}`,
});

export async function seedRouteAuthMatrix(connection: Connection) {
  const now = new Date();
  const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  await connection.collection('users').insertMany(
    Object.values(ROUTE_AUTH_PRINCIPALS).map((principal) => ({
      firebaseUid: principal.firebaseUid,
      nickname: principal.firebaseUid,
      oauth_provider: 'route-auth-matrix',
      roles: [principal.role],
      cake_like_ids: [],
      store_like_ids: [],
      createdAt: now,
      updatedAt: now,
    })),
  );

  await connection.collection('stores').insertOne({
    _id: new Types.ObjectId(ROUTE_AUTH_IDS.storeId),
    name: '권한 매트릭스 매장',
    logo: image('logo.png', 'auth-matrix/logo.png'),
    store_feature: '',
    store_description: '',
    insta_url: '',
    kakako_url: '',
    kakao_map_url: '',
    location: { type: 'Point', coordinates: [127.0, 37.5] },
    address: '서울시 테스트구',
    phone_number: '',
    owner_user_id: ROUTE_AUTH_IDS.sellerOwnerId,
    detail_images: [
      image('detail-1.png', 'auth-matrix/detail-1.png'),
      image('detail-2.png', 'auth-matrix/detail-2.png'),
    ],
    operating_time: [],
    user_like_ids: [],
    taste: ['초코'],
    createdAt: now,
    updatedAt: now,
  });

  await connection.collection('cakes').insertOne({
    _id: new Types.ObjectId(ROUTE_AUTH_IDS.cakeId),
    image: image('cake.png', 'auth-matrix/cake.png'),
    cursor: '000001000000000000001',
    user_like_ids: [],
    owner_store_id: ROUTE_AUTH_IDS.storeId,
    like_ins: '0',
    tag_ins: ['초코'],
    content_ins: '권한 매트릭스 케이크',
    cal_likes: 0,
    faiss_id: 9_000_001,
    is_delete: false,
    createdAt: now,
    updatedAt: now,
  });

  await connection.collection('anniversaries').insertOne({
    _id: new Types.ObjectId(ROUTE_AUTH_IDS.anniversaryId),
    name: '권한 매트릭스 기념일',
    keyword: ['케이크'],
    date: future,
    ment: '권한 매트릭스 테스트',
  });

  await connection.collection('curations').insertOne({
    _id: new Types.ObjectId(ROUTE_AUTH_IDS.curationId),
    cakes: [],
    key: '케이크',
    description: '권한 매트릭스 큐레이션',
    note: '테스트',
    createdAt: now,
    updatedAt: now,
  });
}
