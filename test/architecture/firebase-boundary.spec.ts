import { readdirSync, readFileSync } from 'fs';
import { join, relative, sep } from 'path';

const srcRoot = join(__dirname, '..', '..', 'src');

function sourceFiles(
  directory = srcRoot,
): Array<{ path: string; content: string }> {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolutePath);
    if (!entry.isFile() || !entry.name.endsWith('.ts')) return [];
    return [
      {
        path: relative(srcRoot, absolutePath).split(sep).join('/'),
        content: readFileSync(absolutePath, 'utf8'),
      },
    ];
  });
}

describe('Firebase infrastructure boundary', () => {
  const files = sourceFiles();
  const firebaseAdminImport = /from ['"]firebase-admin(?:\/[^'"]+)?['"]/;

  it('allows Firebase Admin SDK imports only in the infrastructure adapter/provider', () => {
    const violations = files
      .filter((file) => !file.path.endsWith('.spec.ts'))
      .filter((file) => firebaseAdminImport.test(file.content))
      .filter(
        (file) =>
          ![
            'platform/auth/infrastructure/firebase/firebase-app.provider.ts',
            'platform/auth/infrastructure/firebase/firebase-admin-token-verifier.adapter.ts',
          ].includes(file.path),
      )
      .map((file) => file.path);

    expect(violations).toEqual([]);
  });

  it('keeps Firebase app bootstrap out of main.ts', () => {
    const main = readFileSync(join(srcRoot, 'main.ts'), 'utf8');
    expect(main).not.toContain('firebase-admin');
    expect(main).not.toContain('initializeApp');
  });
});
