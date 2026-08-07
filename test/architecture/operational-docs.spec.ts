import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateEnvironment } from 'src/platform/config/environment.validation';
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

describe('.env.example operational contract', () => {
  const envExampleSource = source('.env.example');
  const envExample = parseEnvExample(envExampleSource);

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
});
