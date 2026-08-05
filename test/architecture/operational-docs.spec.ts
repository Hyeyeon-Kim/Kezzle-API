import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateEnvironment } from 'src/config/environment.validation';
import inventory from '../fixtures/environment-inventory.contract.json';

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

  it('replaces the Nest starter with Kezzle service and operations guidance', () => {
    expect(readme).toContain('# Kezzle API');
    expect(readme).not.toContain('Nest framework TypeScript starter');

    [
      '주요 module과 integration',
      'Docker build와 실행',
      'Local Compose topology와 port',
      'Docker 기반 test',
      'Fake Firebase/S3 full-app E2E 경계',
      'Readiness와 graceful shutdown 운영 절차',
      '주요 장애 확인 순서',
    ].forEach((section) => expect(readme).toContain(section));
  });

  it('documents every typed environment variable with its contract', () => {
    inventory.forEach(({ name }) => {
      expect(readme).toMatch(new RegExp('\\|\\s*`' + name + '`\\s*\\|'));
    });
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

  it('keeps documented run, test, endpoint, and shutdown commands executable', () => {
    [
      'docker build -t kezzle-api:local .',
      'docker build --target builder -t kezzle-api:test .',
      'docker compose -p kezzle -f ../docker-compose.yml up -d mongodb',
      'kezzle-api:test npm test -- --runInBand',
      'kezzle-api:test npm run test:e2e',
      'kezzle-api:test npm run test:architecture',
      '$PWD/README.md:/app/README.md:ro',
      '$PWD/.env.example:/app/.env.example:ro',
      'docker compose -p kezzle -f ../docker-compose.yml stop kezzle-api',
      'http://localhost:3000/api-docs',
      'http://localhost:3000/metrics',
      'http://localhost:3000/health/live',
      'http://localhost:3000/health/ready',
    ].forEach((command) => expect(readme).toContain(command));

    expect(readme).not.toMatch(/^npm (install|run|test)/m);
  });
});
