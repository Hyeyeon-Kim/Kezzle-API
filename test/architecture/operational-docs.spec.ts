import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateEnvironment } from 'src/config/environment.validation';
import {
  ALLOWED_EXCEL_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  EXCEL_MAX_BYTES,
  IMAGE_MAX_BYTES,
  IMPORT_MAX_FILE_COUNT,
  IMPORT_MAX_IMAGE_COUNT,
  SINGLE_IMAGE_MAX_FILE_COUNT,
} from 'src/media/api/upload-limits';
import inventory from '../fixtures/environment-inventory.contract.json';
import routeAuthMatrix from '../fixtures/route-auth-matrix.contract.json';
import uploadLimitsContract from '../fixtures/upload-limits.contract.json';
import uploadMediaContract from '../fixtures/upload-media.contract.json';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function parseEnvExample(content: string): Record<string, string> {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        if (separator < 1) throw new Error(`Invalid env example line: ${line}`);
        const name = line.slice(0, separator);
        let value = line.slice(separator + 1);
        if (
          value.length >= 2 &&
          ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'")))
        ) {
          value = value.slice(1, -1);
        }
        return [name, value];
      }),
  );
}

describe('README and operational documentation contract', () => {
  const readme = source('README.md');
  const envExampleSource = source('.env.example');
  const envExample = parseEnvExample(envExampleSource);

  it('documents the Kezzle service and its security boundaries', () => {
    expect(readme).toContain('# Kezzle API');
    expect(readme).not.toContain('Nest framework TypeScript starter');

    [
      '주요 module과 integration',
      '인증·권한 정책',
      '업로드 제한과 파일 검증',
    ].forEach((section) => expect(readme).toContain(section));
  });

  it('keeps .env.example aligned with inventory and validation', () => {
    expect(Object.keys(envExample).sort()).toEqual(
      inventory.map(({ name }) => name).sort(),
    );
    expect(() => validateEnvironment(envExample)).not.toThrow();
  });

  it('uses placeholders and keeps local secret files out of Git and images', () => {
    expect(envExample.FIREBASE_PROJECT_ID).toContain('replace-with');
    expect(envExample.FIREBASE_PRIVATE_KEY).toContain('replace-with');
    expect(envExample.FIREBASE_CLIENT_EMAIL).toContain('replace-with');
    expect(envExample.A_BUCKET_NAME).toContain('replace-with');
    expect(envExample.A_ACCESS_KEY_ID).toBe('');
    expect(envExample.A_SECRET_ACCESS_KEY).toBe('');
    expect(envExampleSource).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(envExampleSource).not.toMatch(/AIza[0-9A-Za-z_-]{35}/);

    const gitignore = source('.gitignore');
    const dockerignore = source('.dockerignore');
    expect(gitignore).toContain('.env\n');
    expect(gitignore).toContain('.env.*');
    expect(gitignore).toContain('!.env.example');
    expect(dockerignore).toContain('.env\n');
    expect(dockerignore).toContain('.env.*');
  });

  it('documents the upload limits, allowlists, and 413/415 contracts', () => {
    [
      IMAGE_MAX_BYTES,
      EXCEL_MAX_BYTES,
      SINGLE_IMAGE_MAX_FILE_COUNT,
      IMPORT_MAX_IMAGE_COUNT,
      IMPORT_MAX_FILE_COUNT,
    ].forEach((value) =>
      expect(readme).toContain(value.toLocaleString('en-US')),
    );
    [...ALLOWED_IMAGE_MIME_TYPES, ...ALLOWED_EXCEL_MIME_TYPES].forEach(
      (contentType) => expect(readme).toContain(contentType),
    );
    [
      uploadLimitsContract.tooLarge,
      uploadMediaContract.unsupportedMime,
      uploadMediaContract.signatureMismatch,
    ].forEach((contract) => {
      expect(readme).toContain(String(contract.status));
      expect(readme).toContain(contract.body.message);
    });
  });

  it('keeps the README authorization summary aligned with the route matrix', () => {
    const policies = [...new Set(routeAuthMatrix.map(({ policy }) => policy))];

    expect(readme).toContain(`${routeAuthMatrix.length}개 route`);
    policies.forEach((policy) => expect(readme).toContain(`\`${policy}\``));
  });
});
