# Type-D Feature service와 API presenter 분리 결과

> 완료일: 2026-07-20
> 상태: 완료
> 라벨: `type: refactor`, `area: db`, `priority: p1`, `size: L`
> 상위 계획: [`8_persistence_application_api_타입_분리_작업_계획서.md`](./8_persistence_application_api_타입_분리_작업_계획서.md)

## 결과

Cake, Store, User, Search, Anniversary, Curation service에서 request/response DTO 의존을 제거했다. controller가 request DTO를 application command/data로 변환하고, service가 반환한 pure view/result는 feature presenter가 기존 API DTO로 표현한다.

```text
API request DTO
      ↓ controller mapping
application command/data → feature service → pure view/result
                                           ↓ controller presenter
                                      API response DTO
```

Search와 Curation은 cake nested 응답을 자체 소유하며 Home도 Cake, Search, Anniversary API DTO를 재사용하지 않는다. 따라서 복합 응답의 JSON 계약은 유지하면서 다른 feature의 API 표현에 대한 의존을 끊었다.

## 구현 범위

### Feature service와 presenter

- Cake: page, detail, recommendation, popular, anniversary pure result와 viewer별 `isLiked` presenter
- Store: create/update application data mapping과 create/detail presenter
- User: register/update command와 create/list/detail presenter
- Search: result/rank/latest pure view와 Search-owned cake response presenter
- Anniversary: repository와 persistence mapper 기반 pure recommendation view
- Curation: create/detail command·view, Curation-owned cake snapshot presenter

request validation과 Swagger decorator는 기존 controller request DTO에 그대로 남겼다. service는 framework API 표현을 알지 않고 controller가 경계를 연결한다.

### 복합 응답 DTO 소유권

- Search 결과의 nested cake DTO는 Search가 소유한다.
- Curation 응답의 nested cake DTO는 Curation이 소유한다.
- Home은 Cake, Anniversary, Search의 API DTO 대신 자체 anniversary/cake/rank/curation DTO로 응답을 구성한다.
- Cake anniversary route와 Home은 같은 Anniversary pure view를 각 endpoint 계약에 맞는 DTO로 따로 표현한다.

기존 cache 또는 e2e mock에 저장된 API-shaped 값도 읽을 수 있도록 경계 DTO에 호환 입력을 유지했고, 실제 HTTP fixture의 key, null/array, pagination, `isLiked` 표현은 변경하지 않았다.

### Curation persistence와 refresh 경계

`CurationRepository`와 `CurationPersistenceMapper`를 추가해 Curation service의 직접 Mongoose model/document 접근을 제거했다. AI 응답과 legacy snapshot의 알려지지 않은 추가 key는 `extra`로 round-trip 보존한다.

refresh 동작은 다음 계약을 유지한다.

- stale 대상 조회와 claim 순서
- claim update의 `timestamps: false`
- refresh 성공 시 cake snapshot과 갱신 시각 저장
- claim 실패, 외부 호출 실패, 저장 실패의 기존 예외 처리
- scheduled refresh와 성공/실패/skip metric

Anniversary 조회도 전용 repository와 mapper로 이동해 service가 Mongoose document 대신 pure view만 다룬다.

## 계약 호환성

- request validation과 Swagger schema 변경 없음
- route, auth/role, status code 변경 없음
- response snake_case key, Image key, optional/null/empty array 변경 없음
- viewer별 `isLiked`와 pagination 변경 없음
- Home cache hit/miss/fallback JSON 변경 없음
- Curation legacy/extra snapshot key와 Mongo timestamp 정책 변경 없음
- DB migration 없음

## Architecture gate

다음 규칙을 `test:architecture`에 추가했다.

- Cake/Store/User/Search/Anniversary/Curation `*.service.ts`의 DTO import 및 DTO 생성 금지
- Search/Curation/Home의 Cake API DTO import 금지
- Curation Mongoose/schema 접근을 repository와 persistence mapper에 한정

source scan으로도 위 세 경계 위반이 모두 0건임을 확인했다.

## 검증 결과

모든 실행 검증은 Docker에서 수행했다.

```text
npm test -- --runInBand
  46 suites, 181 tests passed

npm run test:e2e -- --runInBand
  3 suites, 44 tests passed

npm run test:architecture
  1 suite, 8 tests passed

npm run build
  passed

docker compose build kezzle-api
  passed

docker compose up
  MongoDB healthy, Redis healthy, AI server running
  Nest application successfully started
```

## Type-E 전달 사항

- Home은 nested DTO 소유권을 확보했지만 Home section/cache의 pure view 전환과 `HomePresenter`의 controller 이동은 Type-E에서 수행한다.
- Catalog/Like service 내부의 DTO·presenter 호출을 controller로 올리고 각 복합 API DTO를 endpoint 소유 폴더로 정리한다.
- 기존 Home cache key, TTL, stale-while-revalidate, degraded metadata와 timeout/fallback metric은 그대로 유지한다.
- Type-A HTTP fixture, Type-B legacy persistence round-trip, Type-D architecture gate를 후속 변경의 회귀 기준으로 계속 사용한다.
