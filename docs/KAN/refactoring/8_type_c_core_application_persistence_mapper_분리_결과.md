# Type-C Cake/Store/User application model과 persistence mapper 분리 결과

> 완료일: 2026-07-20
> 상태: 완료
> 라벨: `type: refactor`, `area: db`, `priority: p1`, `size: L`
> 상위 계획: [`8_persistence_application_api_타입_분리_작업_계획서.md`](./8_persistence_application_api_타입_분리_작업_계획서.md)

## 결과

Cake, Store, User repository의 Mongoose document 노출을 제거하고 persistence record를 pure application view로 변환하는 경계를 만들었다. application 내부는 camelCase를 사용하고 Mongo의 `_id`, snake_case field, embedded Image는 repository mapper에서만 변환한다.

```text
Cake/Store/User Mongo document
              ↓ PersistenceMapper
CakeView / StoreView / UserView
              ↓ service·port·adapter
pure application boundary
```

`AuthenticatedUser`도 Mongoose `Document` alias에서 분리했다. `GetUser`, Firebase auth strategy/guard, authorization helper와 Cake·Store·User·Catalog·Like·Home·Search signature가 이 pure current-user type을 사용한다.

## 구현 범위

### Pure application type

- `AuthenticatedUser`, `UserView`, User create/update data
- `CakeView`, Cake create/update data, `CakeImportRow`
- `StoreView`, `StoreSummaryView`, Store create/update data
- persistence와 무관한 공통 `WriteResult`

기존 `IUser`와 잘못된 Mongoose `Document` alias는 제거했다. XLSX 입력 행을 뜻하던 `ICake`는 책임에 맞게 `CakeImportRow`로 교체했다.

### Repository와 persistence mapper

- `CakePersistenceMapper`: `_id`, `owner_store_id`, like/tag/content field, Image, delete flag 변환
- `StorePersistenceMapper`: `_id`, owner/contact/URL field, GeoJSON location, Image 배열 변환
- `UserPersistenceMapper`: `_id`, OAuth provider, roles, Cake/Store like ID 배열 변환

Cake/Store/User repository의 모든 read 반환 타입은 pure view다. create/update 입력도 `Partial<Schema>`, DTO, `Record<string, any>` 대신 feature별 application data type을 받는다. Mongo update 결과는 공통 `WriteResult`로 제한했다.

### User model 소유권

`UserService`의 직접 `@InjectModel(User)` 의존과 `UserModule`의 중복 model 등록을 제거했다. User model 등록은 `UserRepositoryModule` 한 곳만 소유하며, 조회·생성·수정·삭제는 모두 `UserRepository`를 통한다.

`UserResponseDto.roles`는 실제 runtime과 같은 `Roles[]`로 수정했다. User 생성 응답은 repository의 pure `UserView`를 legacy API key로 다시 표현해 `_id`, `oauth_provider`, `cake_like_ids`, `store_like_ids` 계약을 유지한다.

## 계약 호환성

- Mongo field와 collection 변경 없음, DB migration 없음
- Cake/Store owner·admin·other 권한 판정 유지
- Cake storage path의 store name/store ID 정책 유지
- Cake/Store/User like ID 배열과 add/remove query 유지
- 기존 not-found/ownership/already-joined exception 유지
- read API의 snake_case key, Image key, `isLiked`, null/empty array 유지
- User 생성 API의 legacy snake_case key 유지

## 완료 조건 확인

- `IUser`/`ICake` application type 및 잘못된 document alias 제거
- Cake/Store/User service와 public reader/port의 `Document`/`HydratedDocument` 노출 0개
- User model registration은 `UserRepositoryModule` 한 곳
- ObjectId, snake_case, Image, GeoJSON location, roles/like arrays mapper fixture 검증 완료
- 전체 service 계층의 Mongoose document 결합은 Type-B 12줄에서 8줄로 감소했으며 남은 Curation/Counter/Ranking 결합은 Type-D 범위

## 검증 결과

모든 실행 검증은 Docker에서 수행했다.

```text
npm test -- --runInBand
  42 suites, 174 tests passed

npm test -- user.persistence-mapper.spec.ts user.service.spec.ts user.controller.spec.ts --runInBand
  3 suites, 6 tests passed

npm run test:e2e -- --runInBand
  3 suites, 44 tests passed

npm run test:architecture
  1 suite, 5 tests passed

npm run build
  passed
```

## Type-D 전달 사항

- Cake/Store/User service는 repository document에서 분리됐지만 일부 request/response DTO를 아직 사용한다. controller command mapping과 presenter 이동은 Type-D에서 수행한다.
- response DTO의 pure/legacy 양쪽 fallback은 Type-D presenter 도입 시 pure input 하나로 축소한다.
- Curation, Counter, Keyword/Popular ranking의 직접 Mongoose document 결합은 각 repository/mapper로 이동한다.
- Type-A의 HTTP fixture와 Type-B의 legacy persistence round-trip을 후속 gate로 계속 유지한다.
