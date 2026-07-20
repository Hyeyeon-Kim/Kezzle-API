# Type-F Persistence/Application/API architecture gate 결과

> 완료일: 2026-07-20
> 상태: 완료
> 라벨: `type: chore`, `area: infra`, `priority: p1`, `size: M`
> 상위 계획: [`8_persistence_application_api_타입_분리_작업_계획서.md`](./8_persistence_application_api_타입_분리_작업_계획서.md)

## 결과

Type-A~E에서 분리한 Persistence/Application/API 의존 방향을 반복 가능한 Jest architecture gate로 고정했다. 단순 정규식이 아니라 `src/...` absolute import와 `./`, `../` relative import를 모두 source-relative path로 정규화한 뒤 동일한 규칙을 적용한다.

최초 기준선은 다음과 같이 닫혔다.

| 경계 | 최초 | Type-F |
| --- | ---: | ---: |
| Persistence schema/repository → API DTO | 2 | 0 |
| API DTO → persistence schema/document | 4 | 0 |
| application/service/port/reader → `Document` | 12 | 0 |
| service/port/reader → API DTO | 36 | 0 |

## 구현 범위

### Ranking/Counter document generic 제거

다음 service의 `Model<*Document>`를 `Model<SchemaClass>`로 전환했다.

- `CounterService`: `Model<Counter>`
- `KeywordRankService`: `Model<KeywordRank>`
- `PopularRankService`: `Model<PopularCakeRank>`

더 이상 사용되지 않는 `CounterDocument`, `KeywordRankDocument`, `PopularCakeRankDocument` alias와 schema 파일의 `Document` import도 제거했다. 계획 범위대로 직접 `@InjectModel`과 query/refresh 동작은 유지했으며 Mongo collection, field, timestamp 설정은 변경하지 않았다.

### 최종 architecture gate

`test/architecture/feature-boundary.spec.ts`에 다음 규칙을 추가했다.

- persistence schema/repository의 API DTO import 금지
- API DTO의 Mongoose schema/document import 금지
- application/service/port/reader의 `Document`와 `HydratedDocument` 결합 금지
- service/port/reader의 API DTO import 금지
- application type의 Mongoose, Swagger, class-validator, class-transformer 의존 금지
- endpoint 소유 API DTO의 cross-feature import 금지
- `forwardRef` 금지

기존 repository module 캡슐화와 public port export 검증도 유지한다. `test:architecture` 명령은 source scan과 Nest module metadata test에 더해 Type-D/Type-E presenter fixture test를 연속 실행한다.

### 반복 가능한 기준선

`test/architecture/feature-boundary-baseline.md`에 최초 수치, 최종 수치, 수동 `rg` 명령과 Docker architecture 명령을 함께 기록했다. 수동 scan과 Jest 정규화 gate 모두 네 경계 위반 0건을 확인한다.

## 계약 호환성

- Counter sequence update query와 반환 값 변경 없음
- Keyword/Popular rank cold start, SWR refresh, stale 판정 변경 없음
- rank read model collection과 Mongo field 변경 없음
- API route, auth/role, status와 response JSON 변경 없음
- legacy persistence hydrate/round-trip fixture 변경 없음
- DB migration 없음

## 최종 완료 조건

- Persistence → DTO: 0건
- DTO → Persistence: 0건
- application/service/port/reader → `Document`: 0건
- service/port/reader → DTO: 0건
- cross-feature API DTO import: 0건
- `forwardRef`: 0건
- Cake/Store/User/Curation repository는 pure application view 반환
- Home/Catalog/Like/Search/Curation 복합 DTO는 endpoint feature가 소유
- User roles와 authenticated context는 `Roles[]`

## 검증 결과

모든 실행 검증은 Docker에서 수행했다.

```text
npm test -- --runInBand
  47 suites, 188 tests passed

npm run test:e2e -- --runInBand
  3 suites, 44 tests passed

npm run test:architecture
  source/module architecture: 1 suite, 14 tests passed
  presenter contracts: 2 suites, 10 tests passed

docker compose build kezzle-api
  passed

docker compose up -d --force-recreate kezzle-api
  MongoDB healthy, Redis healthy, AI server running
  CounterModule, LogModule and all feature modules initialized
  Nest application successfully started
```

## 후속 범위

이번 Type-A~F 작업은 계획대로 완료했다. dependency-cruiser 또는 ESLint 기반 전체 architecture rule, `modules/integrations/platform` 물리 이동, Log/Ranking/Counter의 repository 추출은 상위 Phase 7 또는 별도 리팩터링 범위로 남긴다.
