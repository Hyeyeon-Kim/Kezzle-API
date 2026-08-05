import { TokenVerificationError } from 'src/platform/auth/application/token-verification.error';
import { FirebaseAdminTokenVerifierAdapter } from './firebase-admin-token-verifier.adapter';

describe('FirebaseAdminTokenVerifierAdapter', () => {
  it('maps the verified SDK token to the pure verified user contract', async () => {
    const firebaseAuth = {
      verifyIdToken: jest.fn().mockResolvedValue({
        uid: 'firebase-user-1',
        firebase: { sign_in_provider: 'google.com' },
      }),
    };
    const adapter = new FirebaseAdminTokenVerifierAdapter(firebaseAuth);

    await expect(adapter.verify('valid-token')).resolves.toEqual({
      uid: 'firebase-user-1',
      signInProvider: 'google.com',
    });
    expect(firebaseAuth.verifyIdToken).toHaveBeenCalledWith(
      'valid-token',
      true,
    );
  });

  it('always enables revoked-token verification and preserves the SDK error code', async () => {
    const sdkError = Object.assign(new Error('ID token has been revoked'), {
      code: 'auth/id-token-revoked',
    });
    const firebaseAuth = {
      verifyIdToken: jest.fn().mockRejectedValue(sdkError),
    };
    const adapter = new FirebaseAdminTokenVerifierAdapter(firebaseAuth);

    await expect(adapter.verify('revoked-token')).rejects.toMatchObject({
      name: TokenVerificationError.name,
      code: 'auth/id-token-revoked',
      message: 'ID token has been revoked',
      cause: sdkError,
    });
    expect(firebaseAuth.verifyIdToken).toHaveBeenCalledWith(
      'revoked-token',
      true,
    );
  });
});
