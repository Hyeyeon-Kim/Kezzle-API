import { MODULE_METADATA } from '@nestjs/common/constants';
import { readdirSync, readFileSync } from 'fs';
import { join, relative, sep } from 'path';
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
