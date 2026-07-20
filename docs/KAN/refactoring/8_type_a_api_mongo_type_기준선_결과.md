# Type-A API/Mongo/type 기준선 결과

> 완료일: 2026-07-20
> 상태: 완료
> 라벨: `type: test`, `area: db`, `priority: p1`, `size: L`
> 상위 계획: [`8_persistence_application_api_타입_분리_작업_계획서.md`](./8_persistence_application_api_타입_분리_작업_계획서.md)

## 결과

기존 Catalog 5개와 Like 2개 read route contract fixture를 유지하면서 Cake, Store, User, Search, Curation, Home의 12개 read route fixture를 추가했다. 총 19개 read route의 URL, auth/role, status, query conversion, response JSON 기준선이 준비됐다.

Type-A는 현재 계약을 고정하는 단계이므로 production source의 type 또는 schema는 변경하지 않았다.

## Contract 범위

### 기존 7개 route

| Feature | Route |
| --- | --- |
| Catalog | `GET /cakes` |
| Catalog | `GET /cakes/location` |
| Catalog | `GET /stores` |
| Catalog | `GET /stores/:id/cakes` |
| Catalog | `GET /cakes/:id/similar` |
| Like | `GET /users/:id/liked-cakes` |
| Like | `GET /users/:id/liked-stores` |

### 신규 12개 route

| Feature | Route | 고정한 주요 계약 |
| --- | --- | --- |
| Cake | `GET /cakes/newest` | `after`/`count` 변환, pagination, Image key, empty hashtag |
| Cake | `GET /cakes/popular` | `after`/`limit` 숫자 변환, rank date window |
| Cake | `GET /cakes/anniversary/:id` | viewer context, page 변환, `isLiked` |
| Cake | `GET /cakes/:id` | viewer별 `isLiked`, full Image JSON |
| Store | `GET /stores/:id` | `logo: null`, `detail_images: []`, `kakako_url`, `is_liked` |
| User | `GET /users` | admin role, `roles[]`, nullable nickname, like array |
| User | `GET /users/:id` | self/admin auth, current-user `roles[]` |
| Search | `GET /search` | keyword/page 변환, pagination, viewer별 `isLiked` |
| Search | `GET /search/rank` | public auth, explicit date range, rank response |
| Search | `GET /search/:id` | self/admin auth, `keywords: []` |
| Curation | `GET /curation/:id` | public auth, page 변환, nested Cake/Image shape |
| Home | `GET /curation` | auth, current-user `roles[]`, section metadata, degraded flag |

Anonymous 요청은 public인 Search rank와 Curation detail을 제외하고 `401`로 고정했다. User list는 admin만 허용하고, User detail과 latest Search는 self 또는 admin만 허용하는 현재 상태를 함께 고정했다.

## Fixture

- 기존 Catalog/Like API fixture: `Kezzle-API/test/fixtures/catalog-like-read.contract.json`
- 신규 12개 route 및 Home fixture: `Kezzle-API/test/fixtures/type-boundary-read.contract.json`
- representative legacy Mongo fixture: `Kezzle-API/test/fixtures/legacy-persistence.contract.json`

Image fixture는 `name`, `converte_name`, `key`, `s3Url`을 모두 포함한다. Store detail은 optional Image 경계인 `logo: null`과 `detail_images: []`를 포함한다. User 응답과 인증 context의 `roles`는 배열로 고정했다.

Home은 cache hit가 반환하는 여섯 section value와 anniversary dependency 실패 시 fallback value를 fixture로 고정했다. 측정마다 달라지는 `durationMs`만 `0`으로 정규화한 후 전체 JSON을 비교한다.

## Legacy Mongo document 기준선

Cake, Store, User, Curation representative document를 현재 Mongoose schema로 `hydrate()`한 뒤 `toObject()`와 JSON 직렬화를 수행해 입력 fixture와 동일한지 확인한다. Mongo 연결이나 write 없이 schema casting과 key 보존 동작만 검증한다.

Curation의 기존 AI fixture `test/fixtures/similar-cakes.mock.json`에서 확인한 cake snapshot key는 다음과 같다.

```text
id
image.s3Url
owner_store_id
cursor
tag_ins
user_like_ids
score
```

Type-A legacy fixture에는 위 key와 `legacy_extra`를 함께 넣었다. 현재 Curation schema의 hydrate/toObject 결과가 모든 key를 유지함을 확인했으므로 Type-B dedicated snapshot schema도 이 key를 삭제하면 안 된다. 실행 중인 로컬 `kezzle` DB의 `curations` collection에는 확인 시점에 document가 없어 실제 데이터 표본은 추가하지 못했다.

Cake/Store legacy Image의 `converte_name`을 포함한 네 key, Store embedded Image의 `_id: false`, User의 `roles`/like ID 배열도 round-trip으로 고정했다.

## Import 기준선

| 경계 | 기준선 |
| --- | ---: |
| Persistence schema → DTO import | 2 |
| DTO → persistence schema import | 4 |
| application/service → `Document` 결합 | 12줄 |
| application service → DTO import | 36줄 |

반복 명령:

```bash
rg -n "dto/" src --glob '**/entities/*.ts'
rg -n "entities/.*[Ss]chema" src --glob '**/dto/*.ts'
rg -n "Document|HydratedDocument" src \
  --glob '**/*.service.ts' --glob '**/*reader.ts' --glob '**/*port.ts' \
  --glob '**/interface/*.ts' --glob '**/interfaces/*.ts'
rg -n "from ['\"][^'\"]*dto" src --glob '**/*.service.ts'
```

## 검증 결과

모든 검증은 `Kezzle-API`를 `/app`에 mount한 `node:22.23.1-slim` Docker container에서 실행했다.

```text
npm test -- --runInBand
  37 suites, 163 tests passed

npm run test:e2e -- --runInBand
  3 suites, 44 tests passed
  - 기존 Catalog/Like contract
  - 신규 Type-A 12 route contract
  - legacy persistence hydrate/toObject contract

npm run test:architecture
  1 suite, 5 tests passed

npm run build
  passed
```

## Type-B 전달 사항

- API/Mongo field 이름을 fixture와 다르게 교정하지 않는다.
- Curation snapshot schema는 최소한 확인된 key와 알 수 없는 추가 key를 보존해야 한다.
- `logo: null`, empty Image arrays, viewer별 `isLiked`, User `roles[]`를 before fixture와 동일하게 유지한다.
- Home cache hit/fallback JSON과 section metadata를 변경하지 않는다.
