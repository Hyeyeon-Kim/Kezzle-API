import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, relative, sep } from 'path';

type SourceFile = {
  readonly path: string;
  readonly content: string;
};

const projectRoot = join(__dirname, '..', '..');
const sourceRoot = join(projectRoot, 'src');

function readSourceFiles(directory = sourceRoot): SourceFile[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return readSourceFiles(absolutePath);
    }
    if (!entry.isFile() || !entry.name.endsWith('.ts')) {
      return [];
    }
    return [
      {
        path: relative(sourceRoot, absolutePath).split(sep).join('/'),
        content: readFileSync(absolutePath, 'utf8'),
      },
    ];
  });
}

describe('Error boundary architecture', () => {
  const productionSources = readSourceFiles().filter(
    (source) => !source.path.endsWith('.spec.ts'),
  );

  it('keeps CustomExceptionFilter deleted and the Nest default boundary unmodified', () => {
    expect(
      existsSync(
        join(sourceRoot, 'platform/config/custom-exception.filter.ts'),
      ),
    ).toBe(false);

    const filterRegistrations = productionSources
      .filter((source) =>
        /\bAPP_FILTER\b|\.useGlobalFilters\s*\(|\bCustomExceptionFilter\b/.test(
          source.content,
        ),
      )
      .map((source) => source.path);

    expect(filterRegistrations).toEqual([]);
  });

  it('keeps Discord webhook code and dependency out of the production tree', () => {
    const packageJson = JSON.parse(
      readFileSync(join(projectRoot, 'package.json'), 'utf8'),
    );
    const packageLock = readFileSync(
      join(projectRoot, 'package-lock.json'),
      'utf8',
    );
    const discordSources = productionSources
      .filter((source) =>
        /discord-webhook-node|DISCORD_WEBHOOK_URL/.test(source.content),
      )
      .map((source) => source.path);

    expect(packageJson.dependencies).not.toHaveProperty('discord-webhook-node');
    expect(packageJson.devDependencies ?? {}).not.toHaveProperty(
      'discord-webhook-node',
    );
    expect(packageLock).not.toContain('discord-webhook-node');
    expect(discordSources).toEqual([]);
  });
});
