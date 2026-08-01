# Feature boundary import baseline

> Measured: 2026-07-16
> Scope: Phase 4-A baseline; update intentionally as Phase 4-B~D closes dependencies.

Run these commands from `Kezzle-API`.

```bash
rg -n "src/cake/.*repository" src --glob '!src/cake/**'
rg -n "src/store/.*repository" src --glob '!src/store/**'
rg -n "src/user/.*repository" src --glob '!src/user/**'
rg -n "src/cake/dto" src/store src/like src/catalog 2>/dev/null
rg -n "src/store/dto" src/cake src/like src/catalog 2>/dev/null
rg -l -U "exports:\\s*\\[[^\\]]*RepositoryModule" \
  src/cake/cake.module.ts src/store/store.module.ts src/user/user.module.ts
rg -n "forwardRef" src

docker run --rm -v "$PWD:/app" -w /app node:22.23.1-slim \
  npm run test:architecture
```

Phase 4-A result:

| Boundary                                                                               | Lines |
| -------------------------------------------------------------------------------------- | ----: |
| Concrete Cake/Store/User repository or repository-module imports outside their feature |    11 |
| Cake/Store API DTO imports from Store/Cake/Like                                        |     9 |
| Feature-module repository-module re-exports                                            |     3 |
| `forwardRef` imports                                                                   |     0 |

Phase 4-D target is `0 / 0 / 0 / 0`. A lower count before Phase 4-D is expected only when the corresponding Phase 4-B or 4-C dependency has intentionally moved behind a public port.

## Phase 4-B result

Measured after moving the five Catalog read routes and their composition logic:

| Boundary                                                                               | Phase 4-A | Phase 4-B |
| -------------------------------------------------------------------------------------- | --------: | --------: |
| Concrete Cake/Store/User repository or repository-module imports outside their feature |        11 |         8 |
| Cake/Store API DTO imports from Store/Cake/Like                                        |         9 |         5 |
| Feature-module repository-module re-exports                                            |         3 |         3 |
| `forwardRef` imports                                                                   |         0 |         0 |

The remaining concrete and DTO imports belong to Cake write context and Like read/write. They are Phase 4-C scope. Repository-module re-exports remain Phase 4-D scope.

## Phase 4-C result

Measured after moving Cake write context and Like read/write behind public ports:

| Boundary                                                                               | Phase 4-B | Phase 4-C |
| -------------------------------------------------------------------------------------- | --------: | --------: |
| Concrete Cake/Store/User repository or repository-module imports outside their feature |         8 |         0 |
| Cake/Store API DTO imports from Store/Cake/Like                                        |         5 |         0 |
| Feature-module repository-module re-exports                                            |         3 |         3 |
| `forwardRef` imports                                                                   |         0 |         0 |

Only repository-module re-exports remain. They are intentionally deferred to Phase 4-D together with the forbidden-import gate.

## Phase 4-D result

Measured after closing Cake/Store/User repository-module exports and adding the repeatable architecture gate:

| Boundary                                                                               | Phase 4-C | Phase 4-D |
| -------------------------------------------------------------------------------------- | --------: | --------: |
| Concrete Cake/Store/User repository or repository-module imports outside their feature |         0 |         0 |
| Cake/Store API DTO imports from Store/Cake/Like                                        |         0 |         0 |
| Feature-module repository-module re-exports                                            |         3 |         0 |
| `forwardRef` imports                                                                   |         0 |         0 |

`npm run test:architecture` scans these forbidden imports and verifies Nest module metadata: repository modules remain internal imports, are not re-exported, and only the public Catalog/Like/write-context ports cross the feature boundary.

## Type-F final result

Measured after completing the Persistence/Application/API type boundary work:

```bash
rg -n "dto/" src --glob '**/entities/*.ts' --glob '**/*.repository.ts'
rg -n "entities/.*[Ss]chema" src --glob '**/api/dto/*.ts' --glob '**/dto/*.ts'
rg -n "Document|HydratedDocument" src \
  --glob '**/application/**/*.ts' --glob '**/*.service.ts' \
  --glob '**/*reader.ts' --glob '**/*port.ts'
rg -n "from ['\"][^'\"]*dto" src \
  --glob '**/*.service.ts' --glob '**/*reader.ts' --glob '**/*port.ts'
```

| Boundary | Initial | Type-F |
| --- | ---: | ---: |
| Persistence schema/repository → API DTO | 2 | 0 |
| API DTO → persistence schema/document | 4 | 0 |
| application/service/port/reader → `Document` | 12 | 0 |
| service/port/reader → API DTO | 36 | 0 |

The Jest architecture gate resolves both `src/...` and relative imports to source-relative paths before applying the final rules. It classifies root `*.persistence-mapper.ts` and the shared Image mapper as persistence sources, rejects `source: any` mapper inputs and persistence model repository returns, and also rejects cross-feature API DTO imports, persistence/API framework imports from application types, and `forwardRef`.

`npm run test:architecture` runs the source scan, Nest module metadata checks, and the Type-D/Type-E presenter contract specs together.
