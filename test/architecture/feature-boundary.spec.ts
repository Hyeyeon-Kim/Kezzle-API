import { MODULE_METADATA } from '@nestjs/common/constants';
import { readdirSync, readFileSync } from 'fs';
import { dirname, join, normalize, relative, sep } from 'path';
import { CakeCatalogReader } from 'src/cake/cake-catalog.reader';
import { CakeLikePort } from 'src/cake/cake-like.port';
import { CakeRepositoryModule } from 'src/cake/cake-repository.module';
import { CakeModule } from 'src/cake/cake.module';
import { CatalogQueryModule } from 'src/catalog/catalog-query.module';
import { LikeModule } from 'src/like/like.module';
import { StoreCakeWriteContextReader } from 'src/store/store-cake-write-context.reader';
import { StoreCatalogReader } from 'src/store/store-catalog.reader';
import { StoreLikePort } from 'src/store/store-like.port';
import { StoreRepositoryModule } from 'src/store/store-repository.module';
import { StoreModule } from 'src/store/store.module';
import { UserLikePort } from 'src/user/user-like.port';
import { UserRepositoryModule } from 'src/user/user-repository.module';
import { UserModule } from 'src/user/user.module';

type SourceFile = {
  path: string;
  content: string;
};

const srcRoot = join(__dirname, '..', '..', 'src');

function readSourceFiles(directory = srcRoot): SourceFile[] {
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
        path: relative(srcRoot, absolutePath).split(sep).join('/'),
        content: readFileSync(absolutePath, 'utf8'),
      },
    ];
  });
}

function importSpecifiers(content: string): string[] {
  const specifiers: string[] = [];
  const importPattern = /(?:from\s+|import\s*)['"]([^'"]+)['"]/g;

  for (const match of content.matchAll(importPattern)) {
    specifiers.push(match[1]);
  }

  return specifiers;
}

function moduleMetadata(module: object, key: string): unknown[] {
  return Reflect.getMetadata(key, module) ?? [];
}

function normalizeImportPath(sourcePath: string, specifier: string): string {
  if (specifier.startsWith('src/')) {
    return specifier.slice('src/'.length);
  }
  if (specifier.startsWith('.')) {
    return normalize(join(dirname(sourcePath), specifier))
      .split(sep)
      .join('/');
  }
  return specifier;
}

describe('Feature boundary architecture', () => {
  const sourceFiles = readSourceFiles();

  it('forbids concrete repository imports outside Cake, Store, and User', () => {
    const violations = sourceFiles.flatMap((source) => {
      const imports = importSpecifiers(source.content);

      return [
        ...(!source.path.startsWith('cake/')
          ? imports.filter((value) => /^src\/cake\/.*repository/.test(value))
          : []),
        ...(!source.path.startsWith('store/')
          ? imports.filter((value) => /^src\/store\/.*repository/.test(value))
          : []),
        ...(!source.path.startsWith('user/')
          ? imports.filter((value) => /^src\/user\/.*repository/.test(value))
          : []),
      ].map((value) => `${source.path}: ${value}`);
    });

    expect(violations).toEqual([]);
  });

  it('forbids Cake and Store API DTO imports across feature boundaries', () => {
    const violations = sourceFiles.flatMap((source) => {
      const imports = importSpecifiers(source.content);
      const forbiddenImports = [
        ...(/^(store|like|catalog)\//.test(source.path)
          ? imports.filter((value) => value.startsWith('src/cake/dto'))
          : []),
        ...(/^(cake|like|catalog)\//.test(source.path)
          ? imports.filter((value) => value.startsWith('src/store/dto'))
          : []),
      ];

      return forbiddenImports.map((value) => `${source.path}: ${value}`);
    });

    expect(violations).toEqual([]);
  });

  it('keeps Type-D feature services independent from API DTOs', () => {
    const targetFeatures = /^(cake|store|user|search|anniversary|curation)\//;
    const violations = sourceFiles
      .filter(
        (source) =>
          targetFeatures.test(source.path) &&
          source.path.endsWith('.service.ts'),
      )
      .flatMap((source) => {
        const dtoImports = importSpecifiers(source.content).filter((value) =>
          /(^|\/)dto(\/|$)/.test(value),
        );
        const dtoConstruction = /new\s+[A-Za-z0-9_]+Dto\s*\(/.test(
          source.content,
        )
          ? ['DTO construction']
          : [];
        return [...dtoImports, ...dtoConstruction].map(
          (value) => `${source.path}: ${value}`,
        );
      });

    expect(violations).toEqual([]);
  });

  it('keeps Search, Curation, and Home independent from Cake API DTOs', () => {
    const violations = sourceFiles
      .filter((source) => /^(search|curation|home)\//.test(source.path))
      .flatMap((source) =>
        importSpecifiers(source.content)
          .filter((value) => value.startsWith('src/cake/dto'))
          .map((value) => `${source.path}: ${value}`),
      );

    expect(violations).toEqual([]);
  });

  it('keeps Curation Mongoose access inside its repository', () => {
    const violations = sourceFiles
      .filter(
        (source) =>
          source.path.startsWith('curation/') &&
          source.path.endsWith('.service.ts'),
      )
      .flatMap((source) =>
        importSpecifiers(source.content)
          .filter(
            (value) =>
              value === 'mongoose' ||
              value === '@nestjs/mongoose' ||
              value.includes('/entities/curation.schema'),
          )
          .map((value) => `${source.path}: ${value}`),
      );

    expect(violations).toEqual([]);
  });

  it('keeps Type-E composite services independent from API DTOs and presenters', () => {
    const violations = sourceFiles
      .filter(
        (source) =>
          /^(home|catalog|like)\//.test(source.path) &&
          source.path.endsWith('.service.ts'),
      )
      .flatMap((source) => {
        const forbiddenImports = importSpecifiers(source.content).filter(
          (value) => /(^|\/)dto(\/|$)|presenter/.test(value),
        );
        const dtoConstruction = /new\s+[A-Za-z0-9_]+Dto\s*\(/.test(
          source.content,
        )
          ? ['DTO construction']
          : [];
        return [...forbiddenImports, ...dtoConstruction].map(
          (value) => `${source.path}: ${value}`,
        );
      });

    expect(violations).toEqual([]);
  });

  it('keeps Home application code independent from feature API DTOs', () => {
    const violations = sourceFiles
      .filter(
        (source) =>
          source.path.startsWith('home/') &&
          !source.path.startsWith('home/api/'),
      )
      .flatMap((source) =>
        importSpecifiers(source.content)
          .map((value) => normalizeImportPath(source.path, value))
          .filter((value) => /^(cake|anniversary|search)\/.*dto/.test(value))
          .map((value) => `${source.path}: ${value}`),
      );

    expect(violations).toEqual([]);
  });

  it('keeps Home, Catalog, and Like API DTOs under their endpoint owner', () => {
    const misplacedDtos = sourceFiles
      .filter((source) => /^(home|catalog|like)\/dto\//.test(source.path))
      .map((source) => source.path);
    const crossFeatureImports = sourceFiles.flatMap((source) =>
      importSpecifiers(source.content)
        .map((value) => normalizeImportPath(source.path, value))
        .filter((value) => /^(home|catalog|like)\/api\/dto\//.test(value))
        .filter((value) => value.split('/')[0] !== source.path.split('/')[0])
        .map((value) => `${source.path}: ${value}`),
    );

    expect([...misplacedDtos, ...crossFeatureImports]).toEqual([]);
  });

  it('forbids forwardRef', () => {
    const violations = sourceFiles
      .filter((source) => source.content.includes('forwardRef'))
      .map((source) => source.path);

    expect(violations).toEqual([]);
  });

  it('keeps repository modules internal and exports only public ports', () => {
    const cakeImports = moduleMetadata(CakeModule, MODULE_METADATA.IMPORTS);
    const storeImports = moduleMetadata(StoreModule, MODULE_METADATA.IMPORTS);
    const userImports = moduleMetadata(UserModule, MODULE_METADATA.IMPORTS);
    const cakeExports = moduleMetadata(CakeModule, MODULE_METADATA.EXPORTS);
    const storeExports = moduleMetadata(StoreModule, MODULE_METADATA.EXPORTS);
    const userExports = moduleMetadata(UserModule, MODULE_METADATA.EXPORTS);

    expect(cakeImports).toContain(CakeRepositoryModule);
    expect(storeImports).toContain(StoreRepositoryModule);
    expect(userImports).toContain(UserRepositoryModule);

    expect(cakeExports).toEqual(
      expect.arrayContaining([CakeCatalogReader, CakeLikePort]),
    );
    expect(storeExports).toEqual(
      expect.arrayContaining([
        StoreCatalogReader,
        StoreCakeWriteContextReader,
        StoreLikePort,
      ]),
    );
    expect(userExports).toEqual(expect.arrayContaining([UserLikePort]));

    expect(cakeExports).not.toContain(CakeRepositoryModule);
    expect(storeExports).not.toContain(StoreRepositoryModule);
    expect(userExports).not.toContain(UserRepositoryModule);
  });

  it('does not import repository modules from composing feature modules', () => {
    const composingImports = [LikeModule, CatalogQueryModule].flatMap(
      (module) => moduleMetadata(module, MODULE_METADATA.IMPORTS),
    );

    expect(composingImports).not.toContain(CakeRepositoryModule);
    expect(composingImports).not.toContain(StoreRepositoryModule);
    expect(composingImports).not.toContain(UserRepositoryModule);
  });
});
