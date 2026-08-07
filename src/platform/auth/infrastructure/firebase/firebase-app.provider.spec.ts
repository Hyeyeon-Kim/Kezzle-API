import { Test } from '@nestjs/testing';
import firebaseConfig from 'src/platform/config/firebase.config';
import { cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { FirebaseAppProvider } from './firebase-app.provider';
import { FirebaseIdentityModule } from './firebase-identity.module';

jest.mock('firebase-admin/app', () => ({
  cert: jest.fn(() => 'credential'),
  initializeApp: jest.fn(() => ({ name: 'kezzle-api' })),
  deleteApp: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({ verifyIdToken: jest.fn() })),
}));

describe('FirebaseAppProvider', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates one named Firebase app per Nest singleton and deletes it once', async () => {
    const config = {
      projectId: 'kezzle-test',
      privateKey:
        '-----BEGIN PRIVATE KEY-----\nplaceholder\n-----END PRIVATE KEY-----',
      clientEmail: 'firebase@example.com',
    };
    const module = await Test.createTestingModule({
      imports: [FirebaseIdentityModule, FirebaseIdentityModule],
    })
      .overrideProvider(firebaseConfig.KEY)
      .useValue(config)
      .compile();

    const first = module.get(FirebaseAppProvider);
    const second = module.get(FirebaseAppProvider);

    expect(first).toBe(second);
    expect(cert).toHaveBeenCalledTimes(1);
    expect(initializeApp).toHaveBeenCalledTimes(1);
    expect(initializeApp).toHaveBeenCalledWith(
      { credential: 'credential' },
      'kezzle-api',
    );

    await module.close();
    await first.onApplicationShutdown();
    expect(deleteApp).toHaveBeenCalledTimes(1);
    expect(deleteApp).toHaveBeenCalledWith(first.app);
  });
});
