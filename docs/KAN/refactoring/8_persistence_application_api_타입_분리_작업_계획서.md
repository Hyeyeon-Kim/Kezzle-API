# Persistence/Application/API 타입 분리 작업 계획서

> 작성일: 2026-07-20
> 문서 상태: Type-E 구현 완료, Type-F 승인 대기
> 상위 로드맵: [`docs/refactoring.md`](../../refactoring.md) 4.5, Phase 3
> 선행 작업: Catalog query와 feature 경계 캡슐화 Phase 4-A~D
> 권장 라벨: `type: refactor`, `area: db`, `priority: p1`, `size: L`

권장 실행 사양: `gpt-5.6-sol` / 기본 추론 - persistence document, application view, API contract를 여러 feature에 걸쳐 단계적으로 분리하고 Mongo 호환성과 endpoint 계약을 함께 검증해야 한다.

## 결론

이 작업은 DTO 이름을 바꾸거나 mapper 하나를 추가하는 작업이 아니다. 다음 의존 방향을 코드와 test gate로 고정하는 작업이다.

```text
Persistence Schema/Document
          ↓ persistence mapper
Pure Application Model / View / Command
          ↓ API presenter
API Request/Response DTO
```

핵심 원칙은 다음과 같다.

1. Mongoose schema와 document는 Swagger/class-validator DTO를 import하지 않는다.
2. repository/adapter 경계에서 document를 pure application type으로 변환한다.
3. application service는 request/response DTO를 import하거나 생성하지 않는다.
4. controller는 request DTO를 application command로 넘기고, presenter가 application result를 response DTO로 변환한다.
5. 복합 응답의 nested DTO는 endpoint 소유 feature가 가진다. 다른 feature의 API DTO를 재사용하지 않는다.
6. Mongo field와 API JSON key는 변경하지 않는다. 특히 `converte_name`, `owner_store_id`, `kakako_url` 같은 기존 key도 이 작업에서 교정하지 않는다.

로드맵 번호는 Phase 3이지만 실제 구현 순서는 완료된 Catalog Phase 4 다음이다. 새 작업에서 다시 “Phase 4”라고 부르지 않고 `Type-A~F`로 구분한다.

## 선행 조건

- Catalog query와 feature 경계 PR의 pure reader/port와 presenter 구조를 기준으로 삼는다.
- 구현 브랜치는 Catalog 작업이 병합된 기준에서 `refactor/persistence-application-api-boundary`로 만든다.
- Catalog PR이 병합 전이면 해당 브랜치를 base로 구현하지 않고, 병합 또는 rebase 이후 기준선을 다시 측정한다.
- DB migration은 만들지 않는다. 현재 document를 새 schema와 mapper가 그대로 읽을 수 있어야 한다.

## 1. 현재 기준선

2026-07-20 현재 `refactor/catalog-query-feature-boundary` 기준이다.

| 경계 위반 | 현재 | 대표 위치 |
| --- | ---: | --- |
| Persistence schema → DTO import | 2 | Cake → `ImageResponseDto`, Curation → `CakeResponseDto` |
| DTO → persistence schema import | 4 | Cake/Store DTO → embedded `Image` schema |
| application/service → Mongoose `Document` 결합 | 12줄 | interface 4줄 + Curation/Ranking/Counter service 8줄 |
| application service → request/response DTO import | 36줄 / 11 services | Cake, Store, User, Search, Anniversary, Curation, Home, Upload, Catalog, Like |

반복 가능한 기준선 명령은 다음과 같다.

```bash
rg -n "dto/" src --glob '**/entities/*.ts'
rg -n "entities/.*[Ss]chema" src --glob '**/dto/*.ts'
rg -n "Document|HydratedDocument" src \
  --glob '**/*.service.ts' --glob '**/*reader.ts' --glob '**/*port.ts' \
  --glob '**/interface/*.ts' --glob '**/interfaces/*.ts'
rg -n "from ['\"][^'\"]*dto" src --glob '**/*.service.ts'
```

### 1.1 문서와 현재 코드의 차이

- `IUser.roles`와 `User` schema는 이미 `Roles[]`다.
- 남은 오류는 `UserResponseDto.roles: Roles`가 실제 실행 값인 배열과 다른 점이다.
- 따라서 roles 변경은 Mongo migration이 아니라 pure current-user/application model과 API DTO의 타입 선언을 `Roles[]`로 맞추는 작업이다.
- `cake/interface/cake.interface.ts`의 `ICake`는 실제 domain Cake가 아니라 XLSX 입력 행(`img`, `fav`, `content`, `hash`)이다.
- 같은 파일의 `UserDocument = ICake & Document`는 이름과 의미가 모두 잘못됐고 사용처도 없다. 이를 domain model로 확대하지 않고 `CakeImportRow`로 이름과 책임을 바로잡는다.

### 1.2 Persistence → API 역방향 의존

```text
cake/entities/cake.schema.ts
  → upload/dto/Image-response.dto.ts

curation/entities/curation.schema.ts
  → cake/dto/response-cake.dto.ts
```

`CakeResponseDto`는 `isLiked` 같은 요청자별 표현을 포함한다. 이를 Curation 저장 schema로 사용하면 persistence snapshot이 API 표현과 로그인 사용자 문맥에 결합된다.

### 1.3 API → Persistence 역방향 의존

다음 DTO가 `upload/entities/image.Schema.ts`의 Mongoose class를 API 타입과 Swagger type으로 사용한다.

- `CakeResponseDto`
- `DetailStoreResponseDto`
- `UpdateStoreDto`
- `UpdateStoreImageDto`

API validation/Swagger 변경이 persistence class에 영향받고, embedded schema 변경도 API compile 범위로 전파된다.

### 1.4 Application service → API DTO 결합

현재 Catalog/Like에는 presenter가 있지만 presenter 호출이 service 안에 있어 query service의 반환 타입이 여전히 DTO다. Home은 Cake/Anniversary/Search DTO를 application 내부 section 값과 cache 값으로 직접 사용한다.

대표 사례:

- `CatalogQueryService` → Catalog response DTO와 `CatalogPresenter`
- `LikeService` → Like response DTO와 `LikePresenter`
- `HomeFeedService` → Cake/Anniversary/Search response DTO
- `SearchService`/`CurationService` → Cake response DTO
- `CakeService`/`StoreService`/`UserService` → 자신의 request/response DTO
- `UploadService` → `ImageResponseDto`

presenter는 API adapter이고 application service가 presenter를 호출하면 의존 방향이 다시 application → API가 된다. presenter 호출 위치를 controller 쪽으로 올려야 한다.

## 2. 목표 타입과 책임

### 2.1 Shared Image 타입

Image는 세 타입을 분리한다.

| 계층 | 타입 | 책임 |
| --- | --- | --- |
| Persistence | `ImageEmbedded`, `ImageEmbeddedSchema` | Mongo embedded document 정의, `_id: false` 유지 |
| Application | `ImageValue` | framework import가 없는 immutable image 값 |
| API | `ImageDto` | Swagger/validation과 기존 JSON key 표현 |

`ImageValue`와 `ImageDto`는 같은 field를 가질 수 있지만 같은 class를 공유하지 않는다. persistence mapper/presenter가 명시적으로 복사한다.

```ts
interface ImageValue {
  readonly name: string;
  readonly converteName: string;
  readonly key: string;
  readonly s3Url: string;
}
```

application에서는 camelCase를 사용할 수 있지만 persistence/API 경계에서 기존 `converte_name`을 그대로 mapping한다. field rename migration은 하지 않는다.

### 2.2 Pure application type

최소 대상은 다음과 같다.

- `AuthenticatedUser`: Firebase UID, nickname, `Roles[]`, like ID 배열
- `UserView`, `CreateUserCommand`, `UpdateUserCommand`
- `CakeView`, `CakeSummaryView`, `CakeImportRow`, Cake write command
- `StoreView`, Store write command
- `CurationView`, `CurationSummaryView`, `CurationCakeSnapshotView`
- `AnniversaryView`, `KeywordRankView`, `LatestSearchView`
- Catalog/Like page/result view
- `HomeView`와 section별 pure fallback/result

이 타입에는 다음 import를 허용하지 않는다.

- `mongoose`, `mongodb`
- `@nestjs/swagger`, `class-validator`, `class-transformer`
- `*/api/dto`
- Mongoose schema class

### 2.3 Mapper와 presenter

```text
CakeRepository/Adapter
  CakeDocument → CakePersistenceMapper → CakeView

CakeService
  CakeView/Command만 사용

CakeController
  request DTO → command → CakeService → CakeView
                                  ↓
                             CakePresenter
                                  ↓
                         CakeResponseDto
```

- persistence mapper는 `_id`, snake_case Mongo field, embedded image를 pure type으로 바꾼다.
- presenter는 `isLiked`, pagination, API snake_case key, null/empty array 정책을 표현한다.
- `isLiked`처럼 viewer 문맥이 필요한 계산은 persistence mapper가 아니라 presenter가 담당한다.
- mapper와 presenter 모두 fixture 기반 unit test를 둔다.

### 2.4 Endpoint 소유 DTO

| Endpoint 소유자 | 소유할 nested DTO |
| --- | --- |
| Home | anniversary, recommend/popular/newest cake, keyword rank, curation item, section metadata |
| Like | liked cake, liked store, liked-store cakes |
| Catalog | catalog cake/store/similar cake와 pagination |
| Search | search result cake, rank, latest search |
| Curation | curation cake summary |
| Cake | Cake 단일/목록/기념일 route response |

예를 들어 Home은 `CakeSimpleResponseDto`나 `RankResponseDto`를 import하지 않는다. Cake/Search service의 pure view를 받아 `HomePresenter`가 Home-owned nested DTO로 변환한다.

공통 Image API 표현은 다른 feature DTO가 아니라 common API value로 취급한다. 그 외 feature API DTO의 교차 import는 0개를 목표로 한다.

## 3. 해결 방법 비교

### 후보 A. schema의 DTO import만 embedded schema로 교체

- 장점: 변경량이 가장 작다.
- 단점: service가 DTO를 생성하고 Home/Search/Curation이 다른 feature DTO를 사용하는 결합은 그대로다.
- 판정: 4.5의 일부 증상만 제거하므로 부적합하다.

### 후보 B. 기존 DTO를 application model로 겸용

- 장점: mapper 수와 타입 수가 적다.
- 단점: Swagger decorator, validation, viewer별 계산이 application/cache/persistence로 역류한다.
- 판정: 현재 문제를 이름만 바꿔 유지하므로 부적합하다.

### 후보 C. vertical slice별 세 계층 분리

- 장점: Mongo/API 계약을 fixture로 고정한 상태에서 Image → core feature → composite endpoint 순으로 안전하게 닫을 수 있다.
- 단점: 얇은 view/DTO가 일부 중복되고 presenter가 늘어난다.
- 판정: 권장한다. 중복은 endpoint 소유권을 드러내는 의도적인 중복으로 제한한다.

## 4. 단계별 실행 계획

각 단계는 같은 작업 브랜치에 별도 commit으로 쌓는다. route 이동과 DTO 제거처럼 중간 compile이 깨질 수 있는 변경은 한 commit 안에서 함께 처리한다.

### Type-A. API/Mongo/type 기준선

권장 type: `test`, area: `db`, size: L

구현 상태: **완료 (2026-07-20)**
결과: [`8_type_a_api_mongo_type_기준선_결과.md`](./8_type_a_api_mongo_type_기준선_결과.md)

1. 기존 Catalog 5개와 Like 2개 contract fixture를 재사용한다.
2. 아직 fixture가 없는 12개 read route를 고정한다.
   - Cake 4개: newest, popular, anniversary, detail
   - Store detail 1개
   - User list/detail 2개
   - Search result/rank/latest 3개
   - Curation detail 1개
   - Home 1개
3. response key, array/null, `isLiked`, pagination, auth/status를 고정한다.
4. `roles`가 실제 JSON과 current-user context에서 배열임을 fixture로 고정한다.
5. Image의 `converte_name`, optional logo/detail image, empty array 경계를 고정한다.
6. representative legacy Cake/Store/User/Curation Mongo document fixture를 만든다.
7. Curation의 실제/fixture `cakes` snapshot에 존재하는 key를 먼저 기록한다. 새 schema가 모르는 key를 삭제하지 않도록 round-trip test를 둔다.
8. 현재 import 기준선 `2 / 4 / 12 / 36`을 문서와 반복 가능한 command로 남긴다.

완료 조건:

- 총 19개 read route(기존 7개 + 신규 12개)의 before fixture가 있다.
- legacy document를 hydrate/toObject 했을 때 nested Image와 Curation cake snapshot key가 유지된다.
- roles 배열, viewer별 `isLiked`, Home cache value와 fallback shape가 test로 고정된다.

### Type-B. Image와 persistence schema 분리

권장 type: `refactor`, area: `db`, size: M

구현 상태: **완료 (2026-07-20)**
결과: [`8_type_b_image_persistence_schema_분리_결과.md`](./8_type_b_image_persistence_schema_분리_결과.md)

1. pure `ImageValue`, persistence `ImageEmbeddedSchema`, API `ImageDto`를 분리한다.
2. Cake/Store schema는 persistence embedded schema만 사용한다.
3. Cake/Store DTO는 API Image DTO만 사용한다.
4. `UploadService.create()`는 `ImageResponseDto`가 아니라 `ImageValue`를 반환한다.
5. Cake/Store application command와 mapper가 `ImageValue`를 사용하도록 전환한다.
6. Curation에는 dedicated `CurationCakeSnapshot` persistence type/schema를 둔다.
7. Curation snapshot은 Type-A fixture에서 확인된 key를 보존한다. 외부 AI 결과가 추가 key를 가질 수 있으면 strict policy를 명시하고 round-trip으로 증명한다.
8. `image.Schema.ts` 대소문자 정리는 import 변경과 함께 수행하되 Mongo field/collection에는 영향을 주지 않는다.

완료 조건:

- Cake/Curation schema의 DTO import 0개다.
- Cake/Store API DTO의 persistence Image schema import 0개다.
- Mongo nested field와 API Image JSON이 before fixture와 동일하다.
- schema 변경만으로 migration이 필요하지 않음을 integration test로 확인한다.

### Type-C. Cake/Store/User application model과 persistence mapper

권장 type: `refactor`, area: `db`, size: L

구현 상태: **완료 (2026-07-20)**
결과: [`8_type_c_core_application_persistence_mapper_분리_결과.md`](./8_type_c_core_application_persistence_mapper_분리_결과.md)

1. `AuthenticatedUser`를 pure application type으로 만들고 `GetUser`, auth/authorization, service signature를 전환한다.
2. `IUser`의 Mongoose `Document` alias를 제거한다.
3. `ICake`를 `CakeImportRow`로 바꾸고 잘못된 `UserDocument` alias를 제거한다.
4. Cake/Store/User repository의 public 반환 타입을 `HydratedDocument`가 아닌 pure view/model로 전환한다.
5. document 접근은 repository 내부에 두고 persistence mapper unit test를 추가한다.
6. write 입력은 `Partial<Schema>`/DTO/`Record<string, any>` 대신 application command/data type을 사용한다.
7. `UserService`의 중복 `@InjectModel(User)`을 제거하고 기존 `UserRepository`로 통합한다.
8. `UserResponseDto.roles`를 `Roles[]`로 수정한다. runtime JSON은 그대로 유지한다.
9. Cake/Store owner/admin/other 권한, storage path, like ID 배열과 exception 타입을 그대로 유지한다.

완료 조건:

- `IUser`/`ICake` application type에서 Mongoose import 0개다.
- Cake/Store/User service와 public port에 `Document`/`HydratedDocument` 노출 0개다.
- User model registration은 repository module 한 곳만 소유한다.
- repository mapper가 ObjectId, snake_case, Image, roles/like arrays를 pure type으로 정확히 변환한다.

### Type-D. Feature service와 API presenter 분리

권장 type: `refactor`, area: `db`, size: L

구현 상태: **완료 (2026-07-20)**
결과: [`8_type_d_feature_service_api_presenter_분리_결과.md`](./8_type_d_feature_service_api_presenter_분리_결과.md)

1. Cake/Store/User/Search/Anniversary/Curation service가 request/response DTO를 import하지 않도록 전환한다.
2. request DTO는 controller에서 application command로 변환한다.
3. service는 pure model/view/result만 반환한다.
4. feature별 presenter가 response DTO를 생성한다.
5. Search 결과의 cake nested DTO는 Search가 소유한다.
6. Curation 응답의 cake nested DTO는 Curation이 소유한다.
7. Anniversary의 pure view를 Cake anniversary route와 Home이 각각 자신의 DTO로 표현한다.
8. Curation model 직접 접근은 `CurationRepository`와 mapper로 이동한다. refresh claim/timestamp 동작과 metric은 유지한다.
9. application command 도입으로 기존 validation DTO와 Swagger schema가 바뀌지 않도록 controller contract를 유지한다.

완료 조건:

- 위 feature의 `*.service.ts`에서 DTO import와 `new *Dto()` 0개다.
- Search/Curation/Home이 Cake API DTO를 import하지 않는다.
- Curation refresh의 claim, stale 판정, `timestamps: false`, 예외/metric 계약이 유지된다.
- request validation과 response JSON fixture가 before와 동일하다.

### Type-E. Home/Catalog/Like 복합 API 소유권 완성

권장 type: `refactor`, area: `home`, `db`, size: L

구현 상태: **완료 (2026-07-20)**
결과: [`8_type_e_home_catalog_like_api_소유권_분리_결과.md`](./8_type_e_home_catalog_like_api_소유권_분리_결과.md)

1. Home/Catalog/Like DTO를 각각 `api/dto` 아래로 이동한다.
2. Home section과 cache value를 다른 feature DTO가 아닌 pure view로 전환한다.
3. `HomeView`와 `HomePresenter`를 추가하고 controller에서 presentation을 수행한다.
4. Home-owned anniversary/cake/rank/curation nested DTO를 둔다.
5. Catalog query service는 pure page/result를 반환하고 controller가 `CatalogPresenter`를 호출한다.
6. Like service는 pure liked result를 반환하고 controller가 `LikePresenter`를 호출한다.
7. Catalog/Like 기존 presenter unit test와 7개 contract fixture를 그대로 재사용한다.
8. cache key, TTL, stale-while-revalidate, degraded/section metadata, timeout/fallback metric을 변경하지 않는다.

완료 조건:

- Home application code의 Cake/Anniversary/Search API DTO import 0개다.
- Catalog/Like service의 DTO/presenter import 0개다.
- 복합 API DTO는 endpoint 소유 feature 외부에서 import되지 않는다.
- Home cache hit/miss/fallback의 직렬화 JSON이 before fixture와 동일하다.

### Type-F. Repository/API 경계 재발 방지

권장 type: `chore`, area: `infra`, size: M

1. 기존 `test:architecture`에 타입 계층 규칙을 추가한다.
2. source import scan과 module/presenter spec을 Docker validation에 포함한다.
3. Curation 외에 남아 있는 Ranking/Counter service의 `*Document` generic은 schema class generic으로 바꿔 application/service 코드의 explicit Document 의존을 닫는다. model injection 자체의 repository 이동은 하지 않는다.
4. dependency-cruiser/ESLint 전체 rule은 상위 Phase 7 범위로 남긴다.

최소 gate:

```bash
rg -n "dto/" src --glob '**/entities/*.ts' --glob '**/*.repository.ts'
rg -n "entities/.*[Ss]chema" src --glob '**/api/dto/*.ts'
rg -n "Document|HydratedDocument" \
  src --glob '**/application/**/*.ts' --glob '**/*.service.ts' \
  --glob '**/*reader.ts' --glob '**/*port.ts'
rg -n "/api/dto" src --glob '**/*.service.ts' \
  --glob '**/*reader.ts' --glob '**/*port.ts'
rg -n "src/(cake|store|user|search|curation|home|like|catalog)/api/dto" \
  src --glob '**/api/dto/*.ts'
```

정규식만으로 relative import를 우회할 수 있으므로 최종 gate는 기존 architecture Jest test처럼 import specifier를 source-relative path로 정규화한다.

완료 조건:

- 기준선 `Persistence→DTO / DTO→Persistence / application·service→Document / service→DTO`가 `2 / 4 / 12 / 36`에서 `0 / 0 / 0 / 0`이다.
- application model/view/command와 service/port/reader에 `Document`/`HydratedDocument` import 0개다. 이 작업에서 제외한 direct `Model` injection은 별도다.
- 다른 feature API DTO import 0개다. common Image API value만 예외로 명시한다.
- `forwardRef` 0개와 Docker Nest DI boot를 유지한다.

## 5. 예상 파일 구조

상위 Phase 6의 전체 `modules/integrations/platform` 이동은 하지 않는다. 이번 작업에 필요한 계층 폴더만 추가한다.

```text
src/common/image/
  application/image.value.ts
  persistence/image.schema.ts
  api/image.dto.ts
  image.mapper.ts

src/cake/
  application/cake.view.ts
  application/cake.command.ts
  application/cake-import-row.ts
  api/dto/
  api/cake.presenter.ts
  entities/cake.schema.ts
  cake.persistence-mapper.ts

src/store/
  application/store.view.ts
  application/store.command.ts
  api/dto/
  api/store.presenter.ts

src/user/
  application/authenticated-user.ts
  application/user.view.ts
  application/user.command.ts
  api/dto/
  api/user.presenter.ts

src/curation/
  application/curation.view.ts
  api/dto/
  api/curation.presenter.ts
  entities/curation-cake-snapshot.schema.ts
  curation.repository.ts
  curation.persistence-mapper.ts

src/home/api/dto/
src/home/api/home.presenter.ts
src/catalog/api/dto/
src/like/api/dto/
```

파일명은 구현 시 현재 naming 정리 Phase와 충돌하지 않도록 kebab-case를 사용한다. 단순 이동만 하는 별도 commit은 만들지 않고 해당 타입의 사용처 전환과 함께 이동한다.

## 6. 검증 계획

### Contract

- 총 19개 read route의 URL, auth/role, status, query conversion, response JSON
- Image의 field/null/optional/array shape
- User roles 배열과 current-user payload
- Home cache hit/miss/fallback/degraded/section metadata
- Catalog/Like pagination, `isLiked`, missing hydration
- Search/Curation nested cake DTO ownership 전환 후 동일 JSON

### Unit

- 각 persistence mapper의 document → pure model mapping
- 각 presenter의 pure view → response DTO mapping
- viewer별 `isLiked`
- request DTO → application command mapping
- ObjectId/string, snake_case/camelCase, optional field, empty array
- Curation snapshot legacy/extra key round-trip

### Integration

- ephemeral Mongo에서 기존 fixture를 새 schema로 hydrate/save/read 후 document shape 비교
- Curation refresh claim과 timestamps 유지
- User repository 단일 model registration과 DI resolution

### Docker

```bash
docker run --rm -v "$PWD:/app" -w /app node:22.23.1-slim \
  npm run test:architecture
docker run --rm -v "$PWD:/app" -w /app node:22.23.1-slim \
  npm test -- --runInBand
docker run --rm -v "$PWD:/app" -w /app node:22.23.1-slim \
  npm run test:e2e -- --runInBand
docker compose -f ../docker-compose.yml build kezzle-api
docker compose -f ../docker-compose.yml up -d mongodb redis ai-server kezzle-api
```

## 7. 리스크와 완화

| 리스크 | 영향 | 완화 |
| --- | --- | --- |
| mapper에서 ObjectId/optional field 누락 | API key가 `undefined` 또는 누락 | before fixture와 mapper unit test |
| Curation snapshot schema가 AI의 추가 key 제거 | 저장된 추천 정보 손실 | Type-A 실제 shape 기록, legacy round-trip, strict policy 명시 |
| DTO constructor를 service 밖으로 옮기며 `isLiked` 변경 | 사용자별 응답 회귀 | viewer fixture와 presenter test |
| Home cache에 class instance 대신 plain view 저장 | cache hit JSON 또는 TTL 회귀 | cache payload before/after 비교, key/TTL 불변 |
| request DTO를 command로 바꾸며 validation 누락 | 잘못된 입력 허용 | validation은 controller DTO에 유지, command mapping test |
| 모든 view를 하나의 거대 domain model로 통합 | endpoint별 필요 field가 다시 결합 | use case별 작은 view 허용 |
| thin DTO/presenter 중복 증가 | 파일 수 증가 | endpoint 소유 응답에만 중복 허용, shared API DTO 남용 금지 |
| schema class/file rename이 collection 변경으로 오인 | Mongo 호환성 우려 | `@Schema` class/collection 설정 유지, integration 확인 |

## 8. 이번 작업에서 하지 않을 것

- Mongo field rename과 data migration
- `converte_name`, `kakako_url`, exception class 오타 같은 외부 계약 수정
- Cake Query/Command/Bulk Import service 전체 책임 분리
- Like dual-write transaction/compensation/outbox
- Log/Ranking/Counter의 모든 `@InjectModel` 제거
- AI client 응답 전체 schema validation과 timeout 정책 변경
- `modules/integrations/platform` 전체 물리 이동
- dependency-cruiser 또는 ESLint architecture rule 도입
- API URL, auth/role, status, pagination 정책 변경

## 9. 최종 완료 조건

- [ ] Persistence schema/repository가 API DTO를 import하지 않는다.
- [ ] API DTO가 Mongoose schema/document class를 import하지 않는다.
- [ ] application service/port/reader가 API DTO와 `Document`/`HydratedDocument`를 import하지 않는다.
- [ ] `AuthenticatedUser.roles`와 User API response roles가 실제 값처럼 배열이다.
- [ ] `ICake`/`IUser`의 잘못된 `Document` alias가 제거된다.
- [ ] Cake/Store/User/Curation repository 경계가 pure type을 반환한다.
- [ ] Home/Like/Catalog/Search/Curation 복합 DTO를 endpoint 소유 feature가 가진다.
- [ ] Mongo document와 API response fixture가 migration 없이 동일하다.
- [ ] architecture 기준선이 `2 / 4 / 12 / 36`에서 `0 / 0 / 0 / 0`이다.
- [ ] `forwardRef` 0개, unit/contract/integration/build/DI boot가 Docker에서 통과한다.

## 10. 권장 commit 분할

| 순서 | 제목 | 라벨 |
| --- | --- | --- |
| Type-A | `test: 타입 경계와 API·Mongo 계약 기준선 추가` | `type: test`, `area: db`, `priority: p1`, `size: L` |
| Type-B | `refactor: Image value와 persistence schema 분리` | `type: refactor`, `area: db`, `priority: p1`, `size: M` |
| Type-C | `refactor: Cake·Store·User application model과 mapper 분리` | `type: refactor`, `area: db`, `priority: p1`, `size: L` |
| Type-D | `refactor: feature service와 API presenter 경계 분리` | `type: refactor`, `area: db`, `priority: p1`, `size: L` |
| Type-E | `refactor: 복합 응답 DTO를 endpoint 소유 API로 이동` | `type: refactor`, `area: home`, `area: db`, `priority: p1`, `size: L` |
| Type-F | `chore: Persistence·Application·API architecture gate 추가` | `type: chore`, `area: infra`, `priority: p1`, `size: M` |

구현은 Type-A 승인부터 시작한다. Type-A 기준선 결과를 검토한 뒤 Type-B~F를 순서대로 진행한다.
