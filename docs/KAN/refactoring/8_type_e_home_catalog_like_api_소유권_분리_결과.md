# Type-E Home/Catalog/Like 복합 API 소유권 분리 결과

> 완료일: 2026-07-20
> 상태: 완료
> 라벨: `type: refactor`, `area: home`, `area: db`, `priority: p1`, `size: L`
> 상위 계획: [`8_persistence_application_api_타입_분리_작업_계획서.md`](./8_persistence_application_api_타입_분리_작업_계획서.md)

## 결과

Home, Catalog, Like의 application service가 API DTO와 presenter를 직접 사용하던 경계를 제거했다. service는 pure view/result만 반환하고 각 controller가 endpoint 소유 presenter를 호출해 기존 HTTP 응답을 생성한다.

```text
feature reader/service → pure Home/Catalog/Like view
                                  ↓ controller
                         endpoint-owned presenter
                                  ↓
                              API DTO
```

세 feature의 DTO와 presenter는 각 `api/` 아래로 모았다. 다른 feature가 이 복합 API DTO를 import할 수 없도록 architecture gate도 추가했다.

## 구현 범위

### Home pure view와 presenter

- `HomeView`, section별 pure data, `HomeSectionMetadataView` 추가
- `HomeFeedService.getHome()` 반환을 `HomeResponseDto`에서 `HomeView`로 전환
- section status/reason/duration 계산은 service의 pure metadata로 유지
- `HomePresenter`를 추가하고 `HomeController`에서 최종 DTO 생성
- Home-owned anniversary/cake/rank/curation/section DTO를 `home/api/dto`로 이동

Home cache refresh 값은 Cake, Anniversary, Search, Curation의 pure view다. 기존 Redis cache에 남아 있을 수 있는 legacy API-shaped 값도 TTL 전환 기간 동안 같은 JSON으로 표현할 수 있도록 Home API presenter의 호환 매핑을 유지했다.

cache key, TTL, stale-while-revalidate, hard deadline, section timeout, fallback/degraded 판정과 metric 호출은 변경하지 않았다.

### Catalog pure page/result

`CatalogCakePageView`, `CatalogStorePageView`, `CatalogSimilarCakePageView`를 추가했다.

- `CatalogQueryService`는 cake/store 조회와 pagination만 수행한다.
- Store page는 store 목록과 `cakesByStoreId` batch 결과를 pure result로 반환한다.
- `SimilarCakeCatalogQueryService`는 VIT 결과와 store summary를 pure similar cake view로 조합한다.
- controller가 viewer UID와 pure page를 `CatalogPresenter`에 전달한다.
- cursor/location/store-cakes/store/similar 응답 DTO를 `catalog/api/dto`로 이동했다.

service에서 viewer가 제거되어 `isLiked` 계산 책임은 API presenter에만 남았다. 기존 geo query 순서, pagination, store batch hydration과 similar-search metric은 유지했다.

### Like pure read result

- `LikeService.findUserLikeCake()`는 `CakeLikeView[]`를 반환한다.
- `LikeService.findUserLikeStore()`는 `LikedStoreCatalogView[]`를 반환한다.
- controller가 target user와 viewer UID를 `LikePresenter`에 전달한다.
- liked Cake/Store DTO와 presenter를 `like/api`로 이동했다.

liked-store의 store `isLiked`는 target user 기준, nested cake `isLiked`는 viewer 기준이라는 기존 의미를 presenter 계약 테스트로 고정했다. self/admin assertion은 service 호출 전에 동기 실행되는 기존 시점을 유지했다.

## 계약 호환성

- Home cache key와 policy 변경 없음
- Home cache hit/miss/fallback/degraded JSON 변경 없음
- Home section timeout, hard deadline와 metric 변경 없음
- Catalog pagination, query conversion, batch hydration 변경 없음
- Like self/admin 권한과 target/viewer `isLiked` 의미 변경 없음
- 총 19개 read HTTP fixture 중 Type-E 관련 Home 1개와 Catalog/Like 7개 응답 변경 없음
- route, auth/role, status, Swagger response type 변경 없음

## Architecture gate

다음 규칙을 `test:architecture`에 추가했다.

- Home/Catalog/Like service의 DTO import, DTO 생성, presenter import 금지
- Home application code의 Cake/Anniversary/Search API DTO import 금지
- Home/Catalog/Like DTO는 각 feature의 `api/dto` 아래에만 위치
- endpoint 소유 API DTO의 다른 feature import 금지

source scan 결과 세 feature service의 DTO/presenter 의존과 기존 `feature/dto` 경로가 모두 0건이다.

## 검증 결과

모든 실행 검증은 Docker에서 수행했다.

```text
npm test -- --runInBand
  47 suites, 188 tests passed

npm run test:e2e -- --runInBand
  3 suites, 44 tests passed

npm run test:architecture
  1 suite, 11 tests passed

docker compose build kezzle-api
  passed

docker compose up -d --force-recreate kezzle-api
  MongoDB healthy, Redis healthy, AI server running
  CatalogQueryModule, HomeModule, LikeModule dependencies initialized
  Nest application successfully started
```

## Type-F 전달 사항

- Type-E architecture rule을 전체 type layer import rule로 확장해 source-relative import 우회까지 최종 차단한다.
- Counter와 Keyword/Popular ranking service의 explicit Mongoose document generic을 schema class generic으로 정리한다.
- 전체 기준선 `Persistence→DTO / DTO→Persistence / application·service→Document / service→DTO`가 `0 / 0 / 0 / 0`인지 최종 측정한다.
- `forwardRef` 0개와 Docker Nest DI boot를 최종 gate로 유지한다.
