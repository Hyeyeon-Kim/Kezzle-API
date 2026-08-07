import { MODULE_METADATA } from '@nestjs/common/constants';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, join, normalize, relative, sep } from 'path';
import { AnniversaryRepositoryPort } from 'src/modules/anniversary/application/port/anniversary-repository.port';
import { AnniversaryService } from 'src/modules/anniversary/application/query/anniversary.service';
import { AnniversaryModule } from 'src/modules/anniversary/anniversary.module';
import { AnniversaryRepository } from 'src/modules/anniversary/infrastructure/persistence/anniversary.repository';
import { CakeCatalogPort } from 'src/modules/cake/application/port/cake-catalog.port';
import { CakeLikePort } from 'src/modules/cake/application/port/cake-like.port';
import { CakeRepositoryPort } from 'src/modules/cake/application/port/cake-repository.port';
import { CakeModule } from 'src/modules/cake/cake.module';
import { CakeImageEmbeddedSchema } from 'src/modules/cake/infrastructure/persistence/schema/cake-image.schema';
import { MongooseCakeRepository } from 'src/modules/cake/infrastructure/persistence/mongoose-cake.repository';
import { AppModule } from 'src/app.module';
import { CatalogQueryModule } from 'src/modules/catalog/catalog-query.module';
import { CounterSequencePort } from 'src/modules/counter/application/port/counter-sequence.port';
import { CounterModule } from 'src/modules/counter/counter.module';
import { CounterService } from 'src/modules/counter/infrastructure/persistence/counter.service';
import { LikeModule } from 'src/modules/like/like.module';
import { CakeLikeEventRecorder } from 'src/modules/like/application/port/cake-like-event-recorder.port';
import { LikeEventModule } from 'src/modules/like/infrastructure/persistence/like-event.module';
import { CakeLikeEventRepository } from 'src/modules/like/infrastructure/persistence/cake-like-event.repository';
import { HomeModule } from 'src/modules/home/home.module';
import { RankingModule } from 'src/modules/ranking/ranking.module';
import { RankingQueryService } from 'src/modules/ranking/application/query/ranking-query.service';
import { KeywordRankingSourceReader } from 'src/modules/ranking/application/port/keyword-ranking-source.reader';
import { PopularRankingSourceReader } from 'src/modules/ranking/application/port/popular-ranking-source.reader';
import { MongoKeywordRankingSourceAdapter } from 'src/modules/ranking/infrastructure/persistence/mongo-keyword-ranking-source.adapter';
import { MongoPopularRankingSourceAdapter } from 'src/modules/ranking/infrastructure/persistence/mongo-popular-ranking-source.adapter';
import { SearchModule } from 'src/modules/search/search.module';
import { StoreCakeWriteContextReader } from 'src/modules/store/application/port/store-cake-write-context.reader';
import { StoreCatalogReader } from 'src/modules/store/application/port/store-catalog.reader';
import { StoreLikePort } from 'src/modules/store/application/port/store-like.port';
import { StoreRepositoryModule } from 'src/modules/store/infrastructure/persistence/store-repository.module';
import { StoreRepositoryPort } from 'src/modules/store/application/port/store-repository.port';
import { StoreRepository } from 'src/modules/store/infrastructure/persistence/store.repository';
import { StoreModule } from 'src/modules/store/store.module';
import { StoreImageEmbeddedSchema } from 'src/modules/store/infrastructure/persistence/schema/store-image.schema';
import { UserLikePort } from 'src/modules/user/application/port/user-like.port';
import { UserRepositoryModule } from 'src/modules/user/infrastructure/persistence/user-repository.module';
import { UserRepositoryPort } from 'src/modules/user/application/port/user-repository.port';
import { UserRepository } from 'src/modules/user/infrastructure/persistence/user.repository';
import { UserModule } from 'src/modules/user/user.module';
import { SearchEventRecorder } from 'src/modules/search/application/port/search-event-recorder.port';
import { SearchHistoryReader } from 'src/modules/search/application/port/search-history.reader';
import { SearchEventModule } from 'src/modules/search/infrastructure/persistence/search-event.module';
import { SearchEventRepository } from 'src/modules/search/infrastructure/persistence/search-event.repository';
import { ObjectStoragePort } from 'src/integrations/media/application/object-storage.port';
import {
  S3_CLIENT,
  S3ObjectStorageAdapter,
} from 'src/integrations/media/infrastructure/s3-object-storage.adapter';
import { S3_STORAGE_CONFIG } from 'src/integrations/media/infrastructure/s3-storage.config';
import { ObjectStorageModule } from 'src/integrations/media/object-storage.module';
import storageConfig from 'src/platform/config/storage.config';
import { CakeMediaService } from 'src/modules/cake/application/media/cake-media.service';
import { CakeImportService } from 'src/modules/cake/application/import/cake-import.service';
import { StoreMediaService } from 'src/modules/store/application/media/store-media.service';
import { MediaObservabilityModule } from 'src/integrations/media/media-observability.module';
import { AuthenticatedUserReader } from 'src/platform/auth/application/authenticated-user.reader';
import { UserService } from 'src/modules/user/application/user.service';
import { AiSearchModule } from 'src/integrations/ai-search/ai-search.module';
import { AiSearchMetricsPort } from 'src/integrations/ai-search/application/ai-search-metrics.port';
import { ClipSearchPort } from 'src/integrations/ai-search/application/clip-search.port';
import { VitSearchPort } from 'src/integrations/ai-search/application/vit-search.port';
import { ClipHttpAdapter } from 'src/integrations/ai-search/infrastructure/http/clip-http.adapter';
import { VitHttpAdapter } from 'src/integrations/ai-search/infrastructure/http/vit-http.adapter';
import { AiSearchMetricsAdapter } from 'src/integrations/ai-search/infrastructure/observability/ai-search-metrics.adapter';

type SourceFile = {
  path: string;
  content: string;
};

const srcRoot = join(__dirname, '..', '..', 'src');
const legacyLogProviderPattern = new RegExp(
  [['L', 'ogModule'].join(''), ['L', 'ogService'].join('')].join('|'),
);
const legacyStorageFacadeIdentifier = ['Up', 'loadService'].join('');

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

function normalizedImports(source: SourceFile): string[] {
  return importSpecifiers(source.content).map((specifier) =>
    normalizeImportPath(source.path, specifier),
  );
}

function isApiDtoPath(path: string): boolean {
  return /(^|\/)(api\/)?dto(\/|$)/.test(path) || /\.dto(?:\.ts)?$/.test(path);
}

function isPersistenceSchemaPath(path: string): boolean {
  return (
    /(^|\/)entities\/.*\.(?:schema|shema)$/.test(path) ||
    /(^|\/)persistence\/.*\.schema$/.test(path)
  );
}

function isPersistenceSource(path: string): boolean {
  return (
    /(^|\/)(entities|persistence)\//.test(path) ||
    path.endsWith('.repository.ts') ||
    isPersistenceMapperPath(path)
  );
}

function isPersistenceMapperPath(path: string): boolean {
  return (
    /\.persistence-mapper(?:\.ts)?$/.test(path) ||
    /(^|\/)image\.mapper(?:\.ts)?$/.test(path)
  );
}

function isApplicationBoundarySource(path: string): boolean {
  return (
    path.includes('/application/') ||
    path.endsWith('.service.ts') ||
    path.endsWith('.reader.ts') ||
    path.endsWith('.port.ts')
  );
}

function isPublicFeatureApplicationContract(path: string): boolean {
  return (
    /^modules\/[^/]+\/application\/(?:port|model)\//.test(path) ||
    /^modules\/[^/]+\/application\/(?:query\/)?(?:[^/]+\.(?:service|view)|[^/]+-result)$/.test(
      path,
    )
  );
}

describe('Feature boundary architecture', () => {
  const sourceFiles = readSourceFiles();

  it('keeps source directories under modules, integrations, platform, or shared', () => {
    const sourceEntries = readdirSync(srcRoot, { withFileTypes: true });
    const sourceDirectories = sourceEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const sourceFiles = sourceEntries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();

    expect(sourceDirectories).toEqual([
      'integrations',
      'modules',
      'platform',
      'shared',
    ]);
    expect(sourceFiles).toEqual(['app.module.ts', 'main.ts']);
  });

  it('keeps every feature root aligned with its layer matrix', () => {
    const featureLayers = {
      anniversary: ['application', 'infrastructure'],
      cake: ['api', 'application', 'infrastructure'],
      catalog: ['api', 'application', 'infrastructure'],
      counter: ['application', 'infrastructure'],
      curation: ['api', 'application', 'infrastructure'],
      home: ['api', 'application', 'infrastructure'],
      like: ['api', 'application', 'infrastructure'],
      ranking: ['api', 'application', 'infrastructure'],
      search: ['api', 'application', 'infrastructure'],
      store: ['api', 'application', 'infrastructure'],
      user: ['api', 'application', 'infrastructure'],
    } as const;
    const featureModules = {
      anniversary: 'anniversary.module.ts',
      cake: 'cake.module.ts',
      catalog: 'catalog-query.module.ts',
      counter: 'counter.module.ts',
      curation: 'curation.module.ts',
      home: 'home.module.ts',
      like: 'like.module.ts',
      ranking: 'ranking.module.ts',
      search: 'search.module.ts',
      store: 'store.module.ts',
      user: 'user.module.ts',
    } as const;

    Object.entries(featureLayers).forEach(([feature, expectedLayers]) => {
      const entries = readdirSync(join(srcRoot, 'modules', feature), {
        withFileTypes: true,
      });
      const directories = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      const files = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort();

      expect(directories).toEqual([...expectedLayers].sort());
      expect(files).toEqual([
        featureModules[feature as keyof typeof featureModules],
      ]);
    });

    expect(
      existsSync(
        join(srcRoot, 'modules', 'cake', 'infrastructure', 'persistence'),
      ),
    ).toBe(true);
  });

  it('forbids concrete repository imports outside Cake, Store, and User', () => {
    const violations = sourceFiles.flatMap((source) => {
      const imports = importSpecifiers(source.content);

      return [
        ...(!source.path.startsWith('modules/cake/')
          ? imports.filter((value) =>
              /^src\/modules\/cake\/.*repository/.test(value),
            )
          : []),
        ...(!source.path.startsWith('modules/store/')
          ? imports.filter((value) =>
              /^src\/modules\/store\/.*repository/.test(value),
            )
          : []),
        ...(!source.path.startsWith('modules/user/')
          ? imports.filter((value) =>
              /^src\/modules\/user\/.*repository/.test(value),
            )
          : []),
      ].map((value) => `${source.path}: ${value}`);
    });

    expect(violations).toEqual([]);
  });

  it('forbids Cake and Store API DTO imports across feature boundaries', () => {
    const violations = sourceFiles.flatMap((source) => {
      const imports = importSpecifiers(source.content);
      const forbiddenImports = [
        ...(/^modules\/(store|like|catalog)\//.test(source.path)
          ? imports.filter((value) =>
              value.startsWith('src/modules/cake/api/dto'),
            )
          : []),
        ...(/^modules\/(cake|like|catalog)\//.test(source.path)
          ? imports.filter((value) => value.startsWith('src/modules/store/dto'))
          : []),
      ];

      return forbiddenImports.map((value) => `${source.path}: ${value}`);
    });

    expect(violations).toEqual([]);
  });

  it('keeps every feature application layer independent from infrastructure', () => {
    const violations = sourceFiles
      .filter(
        (source) =>
          /^modules\/[^/]+\/application\//.test(source.path) &&
          !source.path.endsWith('.spec.ts'),
      )
      .flatMap((source) =>
        normalizedImports(source)
          .filter((value) => /^modules\/[^/]+\/infrastructure\//.test(value))
          .map((value) => `${source.path}: ${value}`),
      );

    expect(violations).toEqual([]);
  });

  it('forbids production features from importing another feature infrastructure', () => {
    const violations = sourceFiles
      .filter(
        (source) =>
          /^modules\/[^/]+\//.test(source.path) &&
          !source.path.endsWith('.spec.ts'),
      )
      .flatMap((source) => {
        const sourceOwner = source.path.split('/')[1];

        return normalizedImports(source)
          .filter((value) => /^modules\/[^/]+\/infrastructure\//.test(value))
          .filter((value) => value.split('/')[1] !== sourceOwner)
          .map((value) => `${source.path}: ${value}`);
      });

    expect(violations).toEqual([]);
  });

  it('limits cross-feature imports to public application contracts and module composition', () => {
    const violations = sourceFiles
      .filter(
        (source) =>
          /^modules\/[^/]+\//.test(source.path) &&
          !source.path.endsWith('.spec.ts'),
      )
      .flatMap((source) => {
        const sourceOwner = source.path.split('/')[1];

        return normalizedImports(source)
          .filter((value) => /^modules\/[^/]+\//.test(value))
          .filter((value) => value.split('/')[1] !== sourceOwner)
          .filter((value) => {
            const parts = value.split('/');
            return !(
              isPublicFeatureApplicationContract(value) ||
              (parts.length === 3 && parts[2].endsWith('.module'))
            );
          })
          .map((value) => `${source.path}: ${value}`);
      });

    expect(violations).toEqual([]);
  });

  it('keeps shared production code independent from frameworks and features', () => {
    const violations = sourceFiles
      .filter(
        (source) =>
          source.path.startsWith('shared/') &&
          !source.path.endsWith('.spec.ts'),
      )
      .flatMap((source) =>
        normalizedImports(source)
          .filter(
            (value) =>
              value.startsWith('@nestjs/') ||
              value === 'mongoose' ||
              value.startsWith('mongoose/') ||
              value.startsWith('modules/'),
          )
          .map((value) => `${source.path}: ${value}`),
      );

    expect(violations).toEqual([]);
  });

  it('exposes AI search ports while keeping HTTP and metrics adapters internal', () => {
    const providers = moduleMetadata(AiSearchModule, MODULE_METADATA.PROVIDERS);
    const exports = moduleMetadata(AiSearchModule, MODULE_METADATA.EXPORTS);
    const applicationInfrastructureImports = sourceFiles
      .filter(
        (source) =>
          source.path.startsWith('integrations/ai-search/application/') &&
          !source.path.endsWith('.spec.ts'),
      )
      .flatMap((source) =>
        normalizedImports(source)
          .filter((value) =>
            value.startsWith('integrations/ai-search/infrastructure/'),
          )
          .map((value) => `${source.path}: ${value}`),
      );

    expect(applicationInfrastructureImports).toEqual([]);
    expect(providers).toEqual(
      expect.arrayContaining([
        VitHttpAdapter,
        ClipHttpAdapter,
        AiSearchMetricsAdapter,
        { provide: VitSearchPort, useExisting: VitHttpAdapter },
        { provide: ClipSearchPort, useExisting: ClipHttpAdapter },
        { provide: AiSearchMetricsPort, useExisting: AiSearchMetricsAdapter },
      ]),
    );
    expect(exports).toEqual([VitSearchPort, ClipSearchPort]);
    expect(exports).not.toEqual(
      expect.arrayContaining([
        VitHttpAdapter,
        ClipHttpAdapter,
        AiSearchMetricsAdapter,
      ]),
    );
  });

  it('keeps platform auth independent from User feature internals', () => {
    const violations = sourceFiles
      .filter(
        (source) =>
          source.path.startsWith('platform/auth/') &&
          !source.path.endsWith('.spec.ts'),
      )
      .flatMap((source) =>
        normalizedImports(source)
          .filter((value) =>
            /^modules\/user\/(api|application|infrastructure)\//.test(value),
          )
          .map((value) => `${source.path}: ${value}`),
      );
    const userProviders = moduleMetadata(UserModule, MODULE_METADATA.PROVIDERS);
    const userExports = moduleMetadata(UserModule, MODULE_METADATA.EXPORTS);

    expect(violations).toEqual([]);
    expect(userProviders).toContainEqual({
      provide: AuthenticatedUserReader,
      useExisting: UserService,
    });
    expect(userExports).toContain(AuthenticatedUserReader);
    expect(userExports).not.toContain(UserService);
  });

  it('keeps Type-D feature services independent from API DTOs', () => {
    const targetFeatures =
      /^modules\/(cake|store|user|search|anniversary|curation)\//;
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
      .filter((source) =>
        /^modules\/(search|curation|home)\//.test(source.path),
      )
      .flatMap((source) =>
        importSpecifiers(source.content)
          .filter((value) => value.startsWith('src/modules/cake/api/dto'))
          .map((value) => `${source.path}: ${value}`),
      );

    expect(violations).toEqual([]);
  });

  it('keeps Curation Mongoose access inside its repository', () => {
    const violations = sourceFiles
      .filter(
        (source) =>
          source.path.startsWith('modules/curation/') &&
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
          /^modules\/(home|catalog|like)\//.test(source.path) &&
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
          source.path.startsWith('modules/home/') &&
          !source.path.startsWith('modules/home/api/'),
      )
      .flatMap((source) =>
        importSpecifiers(source.content)
          .map((value) => normalizeImportPath(source.path, value))
          .filter((value) =>
            /^modules\/(cake|anniversary|search)\/.*dto/.test(value),
          )
          .map((value) => `${source.path}: ${value}`),
      );

    expect(violations).toEqual([]);
  });

  it('keeps Home, Catalog, and Like API DTOs under their endpoint owner', () => {
    const misplacedDtos = sourceFiles
      .filter((source) =>
        /^modules\/(home|catalog|like)\/dto\//.test(source.path),
      )
      .map((source) => source.path);
    const crossFeatureImports = sourceFiles.flatMap((source) =>
      importSpecifiers(source.content)
        .map((value) => normalizeImportPath(source.path, value))
        .filter((value) =>
          /^modules\/(home|catalog|like)\/api\/dto\//.test(value),
        )
        .filter((value) => value.split('/')[1] !== source.path.split('/')[1])
        .map((value) => `${source.path}: ${value}`),
    );

    expect([...misplacedDtos, ...crossFeatureImports]).toEqual([]);
  });

  it('keeps the final type boundary baseline at 0 / 0 / 0 / 0', () => {
    const boundarySources = sourceFiles.filter(
      (source) => !source.path.endsWith('.spec.ts'),
    );
    const persistenceToDto = boundarySources
      .filter((source) => isPersistenceSource(source.path))
      .flatMap((source) =>
        normalizedImports(source)
          .filter(isApiDtoPath)
          .map((value) => `${source.path}: ${value}`),
      );
    const dtoToPersistence = boundarySources
      .filter((source) => isApiDtoPath(source.path))
      .flatMap((source) =>
        normalizedImports(source)
          .filter(
            (value) =>
              isPersistenceSchemaPath(value) ||
              isPersistenceMapperPath(value) ||
              value === 'mongoose' ||
              value === '@nestjs/mongoose',
          )
          .map((value) => `${source.path}: ${value}`),
      );
    const applicationToDocument = boundarySources
      .filter((source) => isApplicationBoundarySource(source.path))
      .filter((source) =>
        /\b(?:Document|HydratedDocument)\b/.test(source.content),
      )
      .map((source) => source.path);
    const serviceToDto = boundarySources
      .filter(
        (source) =>
          source.path.endsWith('.service.ts') ||
          source.path.endsWith('.reader.ts') ||
          source.path.endsWith('.port.ts'),
      )
      .flatMap((source) =>
        normalizedImports(source)
          .filter(isApiDtoPath)
          .map((value) => `${source.path}: ${value}`),
      );

    expect({
      persistenceToDto,
      dtoToPersistence,
      applicationToDocument,
      serviceToDto,
    }).toEqual({
      persistenceToDto: [],
      dtoToPersistence: [],
      applicationToDocument: [],
      serviceToDto: [],
    });
  });

  it('keeps application types independent from persistence and API frameworks', () => {
    const violations = sourceFiles
      .filter((source) => source.path.includes('/application/'))
      .flatMap((source) =>
        normalizedImports(source)
          .filter(
            (value) =>
              isApiDtoPath(value) ||
              isPersistenceSchemaPath(value) ||
              value === 'mongoose' ||
              value === '@nestjs/mongoose' ||
              value === '@nestjs/swagger' ||
              value === 'class-validator' ||
              value === 'class-transformer',
          )
          .map((value) => `${source.path}: ${value}`),
      );

    expect(violations).toEqual([]);
  });

  it('keeps persistence mapper inputs explicit', () => {
    const violations = sourceFiles
      .filter((source) => isPersistenceMapperPath(source.path))
      .filter((source) => /\bsource\??\s*:\s*any\b/.test(source.content))
      .map((source) => source.path);

    expect(violations).toEqual([]);
  });

  it('keeps repository Promise return types free from persistence models', () => {
    const persistenceType =
      /\b(?:Document|HydratedDocument|CakePersistenceModel|Store|User|Curation|Anniversary)\b/;
    const violations = sourceFiles
      .filter((source) => source.path.endsWith('.repository.ts'))
      .flatMap((source) =>
        [...source.content.matchAll(/Promise<([^;\n]+)>/g)]
          .map((match) => match[1])
          .filter((returnType) => persistenceType.test(returnType))
          .map((returnType) => `${source.path}: Promise<${returnType}>`),
      );

    expect(violations).toEqual([]);
  });

  it('forbids API DTO imports across feature owners', () => {
    const featureOwners = new Set([
      'anniversary',
      'cake',
      'catalog',
      'curation',
      'home',
      'like',
      'ranking',
      'search',
      'store',
      'user',
    ]);
    const violations = sourceFiles
      .filter((source) => !source.path.endsWith('.spec.ts'))
      .flatMap((source) => {
        const sourceOwner = source.path.split('/')[1];
        return normalizedImports(source)
          .filter(isApiDtoPath)
          .filter((value) => {
            const targetOwner = value.split('/')[1];
            return (
              featureOwners.has(targetOwner) && targetOwner !== sourceOwner
            );
          })
          .map((value) => `${source.path}: ${value}`);
      });

    expect(violations).toEqual([]);
  });

  it('forbids forwardRef', () => {
    const violations = sourceFiles
      .filter((source) => source.content.includes('forwardRef'))
      .map((source) => source.path);

    expect(violations).toEqual([]);
  });

  it('keeps repository providers internal and exports only public ports', () => {
    const cakeProviders = moduleMetadata(CakeModule, MODULE_METADATA.PROVIDERS);
    const storeImports = moduleMetadata(StoreModule, MODULE_METADATA.IMPORTS);
    const userImports = moduleMetadata(UserModule, MODULE_METADATA.IMPORTS);
    const cakeExports = moduleMetadata(CakeModule, MODULE_METADATA.EXPORTS);
    const storeExports = moduleMetadata(StoreModule, MODULE_METADATA.EXPORTS);
    const userExports = moduleMetadata(UserModule, MODULE_METADATA.EXPORTS);

    expect(cakeProviders).toEqual(
      expect.arrayContaining([
        MongooseCakeRepository,
        {
          provide: CakeRepositoryPort,
          useExisting: MongooseCakeRepository,
        },
      ]),
    );
    expect(storeImports).toContain(StoreRepositoryModule);
    expect(userImports).toContain(UserRepositoryModule);

    expect(cakeExports).toEqual(
      expect.arrayContaining([CakeCatalogPort, CakeLikePort]),
    );
    expect(storeExports).toEqual(
      expect.arrayContaining([
        StoreCatalogReader,
        StoreCakeWriteContextReader,
        StoreLikePort,
      ]),
    );
    expect(userExports).toEqual(expect.arrayContaining([UserLikePort]));

    expect(cakeExports).not.toContain(MongooseCakeRepository);
    expect(cakeExports).not.toContain(CakeRepositoryPort);
    expect(storeExports).not.toContain(StoreRepositoryModule);
    expect(userExports).not.toContain(UserRepositoryModule);
  });

  it('binds repository and sequence ports while keeping infrastructure exports scoped', () => {
    const anniversaryProviders = moduleMetadata(
      AnniversaryModule,
      MODULE_METADATA.PROVIDERS,
    );
    const anniversaryExports = moduleMetadata(
      AnniversaryModule,
      MODULE_METADATA.EXPORTS,
    );
    const counterProviders = moduleMetadata(
      CounterModule,
      MODULE_METADATA.PROVIDERS,
    );
    const counterExports = moduleMetadata(
      CounterModule,
      MODULE_METADATA.EXPORTS,
    );
    const storeProviders = moduleMetadata(
      StoreRepositoryModule,
      MODULE_METADATA.PROVIDERS,
    );
    const storeExports = moduleMetadata(
      StoreRepositoryModule,
      MODULE_METADATA.EXPORTS,
    );
    const userProviders = moduleMetadata(
      UserRepositoryModule,
      MODULE_METADATA.PROVIDERS,
    );
    const userExports = moduleMetadata(
      UserRepositoryModule,
      MODULE_METADATA.EXPORTS,
    );

    expect(anniversaryProviders).toContainEqual({
      provide: AnniversaryRepositoryPort,
      useExisting: AnniversaryRepository,
    });
    expect(counterProviders).toContainEqual({
      provide: CounterSequencePort,
      useExisting: CounterService,
    });
    expect(storeProviders).toContainEqual({
      provide: StoreRepositoryPort,
      useExisting: StoreRepository,
    });
    expect(userProviders).toContainEqual({
      provide: UserRepositoryPort,
      useExisting: UserRepository,
    });

    expect(anniversaryExports).toEqual([AnniversaryService]);
    expect(counterExports).toEqual([CounterSequencePort]);
    expect(storeExports).toEqual(
      expect.arrayContaining([StoreRepository, StoreRepositoryPort]),
    );
    expect(userExports).toEqual(
      expect.arrayContaining([UserRepository, UserRepositoryPort]),
    );
  });

  it('does not import repository modules from composing feature modules', () => {
    const composingImports = [LikeModule, CatalogQueryModule].flatMap(
      (module) => moduleMetadata(module, MODULE_METADATA.IMPORTS),
    );

    expect(composingImports).not.toContain(StoreRepositoryModule);
    expect(composingImports).not.toContain(UserRepositoryModule);
  });

  it('keeps keyword event writes in Search and bounded ranking source reads in Ranking', () => {
    const productionSources = sourceFiles.filter(
      (source) => !source.path.endsWith('.spec.ts'),
    );
    const persistenceViolations = productionSources
      .filter((source) => !source.path.startsWith('modules/search/'))
      .flatMap((source) =>
        normalizedImports(source)
          .filter((value) =>
            /^modules\/search\/infrastructure\/persistence\/search-event\.(?:schema|repository)/.test(
              value,
            ),
          )
          .map((value) => `${source.path}: ${value}`),
      );
    const recorderOrHistoryViolations = productionSources
      .filter((source) => !source.path.startsWith('modules/search/'))
      .flatMap((source) =>
        normalizedImports(source)
          .filter((value) =>
            /^modules\/search\/application\/port\/(?:search-event-recorder\.port|search-history\.reader)/.test(
              value,
            ),
          )
          .map((value) => `${source.path}: ${value}`),
      );
    const logService = productionSources.find(
      (source) => source.path === 'log/log.service.ts',
    );
    const eventModuleExports = moduleMetadata(
      SearchEventModule,
      MODULE_METADATA.EXPORTS,
    );
    const searchImports = moduleMetadata(SearchModule, MODULE_METADATA.IMPORTS);
    const rankingImports = moduleMetadata(
      RankingModule,
      MODULE_METADATA.IMPORTS,
    );
    const rankingProviders = moduleMetadata(
      RankingModule,
      MODULE_METADATA.PROVIDERS,
    );
    const directCollectionReads = productionSources
      .filter(
        (source) =>
          source.path !==
            'modules/search/infrastructure/persistence/search-event.schema.ts' &&
          source.path !==
            'modules/ranking/infrastructure/persistence/mongo-keyword-ranking-source.adapter.ts',
      )
      .filter((source) => /['"]keywordlogs['"]/.test(source.content))
      .map((source) => source.path);
    const sourceAdapter = productionSources.find(
      (source) =>
        source.path ===
        'modules/ranking/infrastructure/persistence/mongo-keyword-ranking-source.adapter.ts',
    );
    const sourceAdapterOwnerImports = normalizedImports(sourceAdapter).filter(
      (value) => /^modules\/(cake|like|search)\//.test(value),
    );

    expect([
      ...persistenceViolations,
      ...recorderOrHistoryViolations,
      ...directCollectionReads,
    ]).toEqual([]);
    expect(logService?.content ?? '').not.toMatch(
      /KeywordLog|searchlog|getLatestWord|getRankWord/,
    );
    expect(searchImports).toContain(SearchEventModule);
    expect(rankingImports).not.toContain(SearchEventModule);
    expect(eventModuleExports).toEqual([
      SearchEventRecorder,
      SearchHistoryReader,
    ]);
    expect(eventModuleExports).not.toContain(SearchEventRepository);
    expect(rankingProviders).toContain(MongoKeywordRankingSourceAdapter);
    expect(rankingProviders).toContainEqual({
      provide: KeywordRankingSourceReader,
      useExisting: MongoKeywordRankingSourceAdapter,
    });
    expect(sourceAdapterOwnerImports).toEqual([]);
    expect(sourceAdapter?.content).toMatch(/['"]keywordlogs['"]/);
    expect(sourceAdapter?.content).toMatch(/\$limit: limit/);
    expect(sourceAdapter?.content).not.toMatch(
      /insertOne|insertMany|updateOne|updateMany|deleteOne|deleteMany|replaceOne/,
    );
  });

  it('keeps cake-like writes owned by Like and bounded source reads isolated in Ranking', () => {
    const productionSources = sourceFiles.filter(
      (source) => !source.path.endsWith('.spec.ts'),
    );
    const persistenceViolations = productionSources
      .filter((source) => !source.path.startsWith('modules/like/'))
      .flatMap((source) =>
        normalizedImports(source)
          .filter((value) =>
            /^modules\/like\/infrastructure\/persistence\/cake-like-event\.(?:schema|repository)/.test(
              value,
            ),
          )
          .map((value) => `${source.path}: ${value}`),
      );
    const recorderViolations = productionSources
      .filter((source) => !source.path.startsWith('modules/like/'))
      .flatMap((source) =>
        normalizedImports(source)
          .filter((value) =>
            /^modules\/like\/application\/port\/cake-like-event-recorder\.port/.test(
              value,
            ),
          )
          .map((value) => `${source.path}: ${value}`),
      );
    const directCollectionReads = productionSources
      .filter(
        (source) =>
          source.path !==
            'modules/like/infrastructure/persistence/cake-like-event.schema.ts' &&
          source.path !==
            'modules/ranking/infrastructure/persistence/mongo-popular-ranking-source.adapter.ts',
      )
      .filter((source) => /['"]cakelikelogs['"]/.test(source.content))
      .map((source) => source.path);
    const likeService = productionSources.find(
      (source) => source.path === 'modules/like/application/like.service.ts',
    );
    const likeImports = moduleMetadata(LikeModule, MODULE_METADATA.IMPORTS);
    const rankingImports = moduleMetadata(
      RankingModule,
      MODULE_METADATA.IMPORTS,
    );
    const eventExports = moduleMetadata(
      LikeEventModule,
      MODULE_METADATA.EXPORTS,
    );
    const rankingProviders = moduleMetadata(
      RankingModule,
      MODULE_METADATA.PROVIDERS,
    );
    const sourceAdapter = productionSources.find(
      (source) =>
        source.path ===
        'modules/ranking/infrastructure/persistence/mongo-popular-ranking-source.adapter.ts',
    );
    const sourceAdapterOwnerImports = normalizedImports(sourceAdapter).filter(
      (value) => /^modules\/(cake|like|search)\//.test(value),
    );

    expect([
      ...persistenceViolations,
      ...recorderViolations,
      ...directCollectionReads,
    ]).toEqual([]);
    expect(likeService?.content ?? '').not.toMatch(legacyLogProviderPattern);
    expect(likeImports).not.toContain(RankingModule);
    expect(rankingImports).not.toContain(LikeEventModule);
    expect(eventExports).toEqual([CakeLikeEventRecorder]);
    expect(eventExports).not.toContain(CakeLikeEventRepository);
    expect(rankingProviders).toContain(MongoPopularRankingSourceAdapter);
    expect(rankingProviders).toContainEqual({
      provide: PopularRankingSourceReader,
      useExisting: MongoPopularRankingSourceAdapter,
    });
    expect(sourceAdapterOwnerImports).toEqual([]);
    expect(sourceAdapter?.content).toMatch(/['"]cakelikelogs['"]/);
    expect(sourceAdapter?.content).toMatch(/['"]cakes['"]/);
    expect(sourceAdapter?.content).toMatch(/\$limit: query\.limit/);
    expect(sourceAdapter?.content).toMatch(/onError: 0/);
    expect(sourceAdapter?.content).toMatch(/onNull: 0/);
    expect(sourceAdapter?.content).not.toMatch(
      /insertOne|insertMany|updateOne|updateMany|deleteOne|deleteMany|replaceOne/,
    );
  });

  it('keeps rank internals, read models, and routes owned by Ranking', () => {
    const productionSources = sourceFiles.filter(
      (source) => !source.path.endsWith('.spec.ts'),
    );
    const rankingImportsOutsideOwner = productionSources
      .filter((source) => !source.path.startsWith('modules/ranking/'))
      .flatMap((source) =>
        normalizedImports(source)
          .filter((value) => value.startsWith('modules/ranking/'))
          .filter((value) => {
            if (source.path === 'app.module.ts') {
              return value !== 'modules/ranking/ranking.module';
            }
            if (source.path === 'modules/home/home.module.ts') {
              return value !== 'modules/ranking/ranking.module';
            }
            if (source.path.startsWith('modules/home/')) {
              return ![
                'modules/ranking/application/query/ranking-query.service',
                'modules/ranking/application/query/ranking.view',
              ].includes(value);
            }
            return true;
          })
          .map((value) => `${source.path}: ${value}`),
      );
    const rankWindowImportsOutsideOwner = productionSources
      .filter((source) => !source.path.startsWith('modules/ranking/'))
      .filter((source) =>
        normalizedImports(source).some((value) =>
          value.endsWith('rank-window'),
        ),
      )
      .map((source) => source.path);
    const directReadModelCollections = productionSources
      .filter(
        (source) =>
          source.path !==
            'modules/ranking/infrastructure/persistence/keyword-rank.schema.ts' &&
          source.path !==
            'modules/ranking/infrastructure/persistence/popular-cake-rank.schema.ts',
      )
      .filter((source) =>
        /['"](?:keywordranks|popularcakeranks)['"]/.test(source.content),
      )
      .map((source) => source.path);
    const rankingExports = moduleMetadata(
      RankingModule,
      MODULE_METADATA.EXPORTS,
    );
    const homeImports = moduleMetadata(HomeModule, MODULE_METADATA.IMPORTS);
    const searchImports = moduleMetadata(SearchModule, MODULE_METADATA.IMPORTS);
    const cakeImports = moduleMetadata(CakeModule, MODULE_METADATA.IMPORTS);
    const appImports = moduleMetadata(AppModule, MODULE_METADATA.IMPORTS);
    const sourceByPath = new Map(
      productionSources.map((source) => [source.path, source.content]),
    );

    expect(existsSync(join(srcRoot, 'log'))).toBe(false);
    expect([
      ...rankingImportsOutsideOwner,
      ...rankWindowImportsOutsideOwner,
      ...directReadModelCollections,
    ]).toEqual([]);
    expect(rankingExports).toEqual([RankingQueryService]);
    expect(homeImports).toContain(RankingModule);
    expect(searchImports).not.toContain(RankingModule);
    expect(cakeImports).not.toContain(RankingModule);
    expect(appImports).toContain(RankingModule);
    expect(appImports.indexOf(RankingModule)).toBeLessThan(
      appImports.indexOf(SearchModule),
    );
    expect(appImports.indexOf(RankingModule)).toBeLessThan(
      appImports.indexOf(CakeModule),
    );
    expect(appImports.indexOf(RankingModule)).toBeLessThan(
      appImports.indexOf(CatalogQueryModule),
    );
    expect(
      sourceByPath.get('modules/ranking/api/ranking.controller.ts'),
    ).toMatch(/Get\('search\/rank'\)/);
    expect(
      sourceByPath.get('modules/ranking/api/ranking.controller.ts'),
    ).toMatch(/Get\('cakes\/popular'\)/);
    expect(
      sourceByPath.get('modules/search/api/search.controller.ts'),
    ).not.toMatch(/Get\('rank'\)/);
    expect(sourceByPath.get('modules/cake/api/cake.controller.ts')).not.toMatch(
      /Get\('cakes\/popular'\)/,
    );
    expect(
      sourceByPath.get('modules/home/application/home-feed.service.ts'),
    ).not.toMatch(/rank-window|SearchService|\.popular\(/);
  });

  it('keeps Cake and Store image persistence owned by each feature', () => {
    const productionSources = sourceFiles.filter(
      (source) => !source.path.endsWith('.spec.ts'),
    );
    const sourceByPath = new Map(
      productionSources.map((source) => [source.path, source]),
    );
    const cakeSchema = sourceByPath.get(
      'modules/cake/infrastructure/persistence/schema/cake.schema.ts',
    );
    const storeSchema = sourceByPath.get(
      'modules/store/infrastructure/persistence/schema/store.schema.ts',
    );
    const aiSearchResultMapper = sourceByPath.get(
      'integrations/ai-search/infrastructure/http/ai-search-result.mapper.ts',
    );
    const commonImageMongooseImports = productionSources
      .filter((source) => source.path.startsWith('shared/image/'))
      .flatMap((source) =>
        normalizedImports(source)
          .filter(
            (value) => value === '@nestjs/mongoose' || value === 'mongoose',
          )
          .map((value) => `${source.path}: ${value}`),
      );
    const imageFields = ['converte_name', 'key', 'name', 's3Url'];

    expect(normalizedImports(cakeSchema)).toContain(
      'modules/cake/infrastructure/persistence/schema/cake-image.schema',
    );
    expect(normalizedImports(storeSchema)).toContain(
      'modules/store/infrastructure/persistence/schema/store-image.schema',
    );
    expect(normalizedImports(cakeSchema)).not.toContain(
      'modules/store/infrastructure/persistence/schema/store-image.schema',
    );
    expect(normalizedImports(storeSchema)).not.toContain(
      'modules/cake/infrastructure/persistence/schema/cake-image.schema',
    );
    expect(commonImageMongooseImports).toEqual([]);
    expect(existsSync(join(srcRoot, 'shared/image/persistence'))).toBe(false);
    expect(normalizedImports(aiSearchResultMapper)).toContain(
      'shared/image/application/image-external.mapper',
    );
    expect(normalizedImports(aiSearchResultMapper)).not.toContain(
      'modules/cake/infrastructure/persistence/cake.persistence-mapper',
    );
    expect(CakeImageEmbeddedSchema.get('_id')).toBe(false);
    expect(StoreImageEmbeddedSchema.get('_id')).toBe(false);
    expect(Object.keys(CakeImageEmbeddedSchema.paths).sort()).toEqual(
      imageFields,
    );
    expect(Object.keys(StoreImageEmbeddedSchema.paths).sort()).toEqual(
      imageFields,
    );
    expect(CakeImageEmbeddedSchema).not.toBe(StoreImageEmbeddedSchema);
  });

  it('keeps object storage application contracts pure and AWS access in the S3 adapter', () => {
    const productionSources = sourceFiles.filter(
      (source) => !source.path.endsWith('.spec.ts'),
    );
    const awsImports = productionSources
      .filter((source) => normalizedImports(source).includes('aws-sdk'))
      .map((source) => source.path);
    const applicationFrameworkImports = productionSources
      .filter((source) =>
        source.path.startsWith('integrations/media/application/'),
      )
      .flatMap((source) =>
        normalizedImports(source)
          .filter(
            (value) =>
              value.startsWith('@nestjs/') ||
              value === 'aws-sdk' ||
              value === 'express' ||
              value.includes('multer'),
          )
          .map((value) => `${source.path}: ${value}`),
      );
    const featureStorageViolations = productionSources
      .filter((source) => /^modules\/(cake|store)\//.test(source.path))
      .filter(
        (source) =>
          normalizedImports(source).includes('aws-sdk') ||
          /\bnew\s+S3\b|A_BUCKET_NAME|process\.env/.test(source.content),
      )
      .map((source) => source.path);
    const adapter = productionSources.find(
      (source) =>
        source.path ===
        'integrations/media/infrastructure/s3-object-storage.adapter.ts',
    );
    const s3Config = productionSources.find(
      (source) =>
        source.path ===
        'integrations/media/infrastructure/s3-storage.config.ts',
    );
    const storageProviders = moduleMetadata(
      ObjectStorageModule,
      MODULE_METADATA.PROVIDERS,
    );
    const storageImports = moduleMetadata(
      ObjectStorageModule,
      MODULE_METADATA.IMPORTS,
    );
    const storageExports = moduleMetadata(
      ObjectStorageModule,
      MODULE_METADATA.EXPORTS,
    );

    expect(awsImports).toEqual([
      'integrations/media/infrastructure/s3-object-storage.adapter.ts',
    ]);
    expect(applicationFrameworkImports).toEqual([]);
    expect(featureStorageViolations).toEqual([]);
    expect(adapter?.content).not.toContain('process.env');
    expect(s3Config?.content).not.toMatch(
      /process\.env|A_BUCKET_NAME|A_REGION|A_ACCESS_KEY_ID|A_SECRET_ACCESS_KEY/,
    );
    expect(storageImports).toContain(MediaObservabilityModule);
    expect(storageProviders).toContain(S3ObjectStorageAdapter);
    expect(storageProviders).toContainEqual({
      provide: ObjectStoragePort,
      useExisting: S3ObjectStorageAdapter,
    });
    expect(storageExports).toEqual([ObjectStoragePort]);
    expect(storageProviders).toContainEqual(
      expect.objectContaining({
        provide: S3_STORAGE_CONFIG,
        inject: [storageConfig.KEY],
      }),
    );
    expect(storageProviders).toContainEqual(
      expect.objectContaining({
        provide: S3_CLIENT,
        inject: [S3_STORAGE_CONFIG],
      }),
    );
  });

  it('keeps Cake and Store media orchestration in feature media services', () => {
    const productionSources = sourceFiles.filter(
      (source) => !source.path.endsWith('.spec.ts'),
    );
    const sourceByPath = new Map(
      productionSources.map((source) => [source.path, source]),
    );
    const objectStorageConsumers = productionSources
      .filter((source) => /^modules\/(cake|store)\//.test(source.path))
      .filter((source) =>
        normalizedImports(source).includes(
          'integrations/media/application/object-storage.port',
        ),
      )
      .map((source) => source.path)
      .sort();
    const cakeService = sourceByPath.get(
      'modules/cake/application/query/cake-query.service.ts',
    );
    const storeService = sourceByPath.get(
      'modules/store/application/store.service.ts',
    );
    const cakeImport = sourceByPath.get(
      'modules/cake/application/import/cake-import.service.ts',
    );
    const cakeProviders = moduleMetadata(CakeModule, MODULE_METADATA.PROVIDERS);
    const cakeImports = moduleMetadata(CakeModule, MODULE_METADATA.IMPORTS);
    const storeProviders = moduleMetadata(
      StoreModule,
      MODULE_METADATA.PROVIDERS,
    );
    const storeImports = moduleMetadata(StoreModule, MODULE_METADATA.IMPORTS);

    expect(objectStorageConsumers).toEqual([
      'modules/cake/application/media/cake-media.service.ts',
      'modules/store/application/media/store-media.service.ts',
    ]);
    expect(cakeService?.content).not.toMatch(
      new RegExp(
        [legacyStorageFacadeIdentifier, 'ObjectStoragePort', 'xlsx'].join('|'),
      ),
    );
    expect(storeService?.content).not.toMatch(
      new RegExp(
        [legacyStorageFacadeIdentifier, 'ObjectStoragePort'].join('|'),
      ),
    );
    expect(normalizedImports(cakeImport)).toContain(
      'modules/cake/application/media/cake-media.service',
    );
    expect(normalizedImports(cakeImport)).not.toContain(
      'integrations/media/application/object-storage.port',
    );
    expect(cakeProviders).toEqual(
      expect.arrayContaining([CakeMediaService, CakeImportService]),
    );
    expect(cakeImports).toContain(MediaObservabilityModule);
    expect(storeProviders).toContain(StoreMediaService);
    expect(storeImports).toContain(MediaObservabilityModule);
  });

  it('keeps removed legacy log and upload modules out of the source tree', () => {
    const productionSources = sourceFiles.filter(
      (source) => !source.path.endsWith('.spec.ts'),
    );
    const removedDirectories = [['l', 'og'].join(''), ['up', 'load'].join('')];
    const removedIdentifiers = [
      ...legacyLogProviderPattern.source.split('|'),
      ['Up', 'loadModule'].join(''),
      legacyStorageFacadeIdentifier,
    ];
    const removedIdentifierPattern = new RegExp(removedIdentifiers.join('|'));
    const identifierViolations = productionSources
      .filter((source) => removedIdentifierPattern.test(source.content))
      .map((source) => source.path);
    const legacyPathViolations = productionSources.flatMap((source) =>
      normalizedImports(source)
        .filter((value) =>
          removedDirectories.some(
            (directory) =>
              value === directory || value.startsWith(`${directory}/`),
          ),
        )
        .map((value) => `${source.path}: ${value}`),
    );
    const appImports = moduleMetadata(AppModule, MODULE_METADATA.IMPORTS);
    const cakeImports = moduleMetadata(CakeModule, MODULE_METADATA.IMPORTS);
    const storeImports = moduleMetadata(StoreModule, MODULE_METADATA.IMPORTS);

    expect(
      removedDirectories.map((directory) =>
        existsSync(join(srcRoot, directory)),
      ),
    ).toEqual([false, false]);
    expect(identifierViolations).toEqual([]);
    expect(legacyPathViolations).toEqual([]);
    expect(appImports).not.toContain(ObjectStorageModule);
    expect(cakeImports).toContain(ObjectStorageModule);
    expect(storeImports).toContain(ObjectStorageModule);
  });
});
