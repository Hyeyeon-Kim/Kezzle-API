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
rg -n "exports:.*RepositoryModule" \
  src/cake/cake.module.ts src/store/store.module.ts src/user/user.module.ts
rg -n "forwardRef" src
```

Current result:

| Boundary | Lines |
| --- | ---: |
| Concrete Cake/Store/User repository or repository-module imports outside their feature | 11 |
| Cake/Store API DTO imports from Store/Cake/Like | 9 |
| Feature-module repository-module re-exports | 3 |
| `forwardRef` imports | 0 |

Phase 4-D target is `0 / 0 / 0 / 0`. A lower count before Phase 4-D is expected only when the corresponding Phase 4-B or 4-C dependency has intentionally moved behind a public port.
