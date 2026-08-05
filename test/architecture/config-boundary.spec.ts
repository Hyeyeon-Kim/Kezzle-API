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

describe('Typed config architecture boundary', () => {
  const files = sourceFiles();

  it('keeps direct environment access inside config composition only', () => {
    const violations = files
      .filter((file) => !file.path.startsWith('platform/config/'))
      .filter((file) => /process\.env/.test(file.content))
      .map((file) => file.path);

    expect(violations).toEqual([]);
  });

  it('keeps feature services independent from raw ConfigService lookups', () => {
    const violations = files
      .filter((file) => file.path.endsWith('.service.ts'))
      .filter((file) => /\bConfigService\b/.test(file.content))
      .map((file) => file.path);

    expect(violations).toEqual([]);
  });

  it('validates the environment before Nest creates networked modules', () => {
    const main = readFileSync(join(srcRoot, 'main.ts'), 'utf8');
    const validation = main.indexOf('validateEnvironment()');
    const nestCreation = main.indexOf('NestFactory.create');
    const listen = main.indexOf('.listen(');

    expect(validation).toBeGreaterThan(-1);
    expect(validation).toBeLessThan(nestCreation);
    expect(nestCreation).toBeLessThan(listen);
  });

  it('registers the shared AI transport timeout from typed config', () => {
    const aiModule = readFileSync(
      join(srcRoot, 'integrations/ai-search/ai-search.module.ts'),
      'utf8',
    );

    expect(aiModule).toContain('HttpModule.registerAsync');
    expect(aiModule).toContain('inject: [aiConfig.KEY]');
    expect(aiModule).toContain('timeout: config.httpTimeoutMs');
  });
});
