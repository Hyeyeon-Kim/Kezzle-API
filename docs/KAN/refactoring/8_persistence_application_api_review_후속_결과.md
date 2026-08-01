# Persistence/Application/API 타입 분리 review 후속 결과

> 완료일: 2026-08-01
> 상태: 완료
> 라벨: `type: bug`, `type: test`, `area: db`, `area: home`, `area: cache`, `priority: p1`, `size: L`
> 상위 계획: [`8_persistence_application_api_타입_분리_작업_계획서.md`](./8_persistence_application_api_타입_분리_작업_계획서.md)

## 결과

Type-A~F review에서 확인된 Curation hydrated subdocument, Home cache rolling deployment, 실제 Mongo integration, write API 계약, architecture gate 사각지대를 보강했다. Mongo/API 외부 field 이름과 route/status 정책은 유지했다.

## 수정 사항

### Curation hydrated document

- `CurationPersistenceMapper` 진입 시 Mongoose document를 `toObject()`로 POJO화한다.
- nested snapshot mapper도 hydrated subdocument를 직접 받는 경우 POJO화한다.
- 실제 hydrated Curation document를 mapper와 presenter에 통과시켜 JSON 직렬화하고 `_doc`, `$__`가 노출되지 않으며 `legacy_extra`는 유지됨을 검증한다.

### Home cache rolling deployment

- Home cache wire key를 `home:v2:*` namespace로 분리했다.
- 신버전 replica는 v2 key만 읽고 쓰며, 구버전 replica는 기존 `home:*` key만 사용하므로 서로 다른 camelCase/snake_case payload가 같은 Redis key를 덮어쓰지 않는다.
- rollback 시 구버전 key가 만료됐다면 기존 refresh 경로로 cold miss를 복구한다. dual-write는 하지 않는다.

### 실제 Mongo integration

- Docker Compose MongoDB의 고유 test DB에서 Cake, Store, User, Curation legacy fixture를 실제 저장하고 다시 조회해 key와 nested shape를 비교한다.
- 실제 write에서 Cake number casting과 boolean default, Store default/empty array, User role/like array default를 검증한다.
- Curation refresh claim은 `updatedAt`을 바꾸지 않고, cakes 갱신은 `updatedAt`을 증가시키며 `strict:false` extra key를 보존하는지 확인한다.
- test 종료 시 고유 test DB를 삭제한다.

### Write HTTP 계약

- Cake, Store, User, Curation create route의 auth/role, status, request/query 변환, response fixture를 추가했다.
- Store/User request validation의 정상·거부 경로를 포함했다.
- Store create의 빈 `detail_images`는 기존 document 응답처럼 `[]`로 유지한다.
- read HTTP mock도 persistence JSON이 아니라 pure application view를 반환하도록 교정했다.

### Architecture gate

- API `ImageDto`의 `ImagePersistenceRecord`/`ImageMapper` 의존을 제거하고 API↔application 변환만 소유하게 했다.
- root `*.persistence-mapper.ts`와 shared Image mapper를 persistence source로 인식한다.
- persistence mapper `source: any`와 repository의 persistence model/document `Promise` 반환을 금지한다.
- Cake/Store/User/Curation/Anniversary mapper 입력을 명시적인 source shape로 제한한다.

## 검증 결과

모든 실행 검증은 Docker에서 수행했다.

```text
npm run lint
  passed

npm run build
  passed

npm test -- --runInBand
  47 suites, 189 tests passed

npm run test:e2e -- --runInBand
  4 suites, 48 tests passed

npm run test:integration:mongo
  1 suite, 3 tests passed

npm run test:architecture
  source/module architecture: 1 suite, 16 tests passed
  presenter contracts: 2 suites, 10 tests passed

docker compose -f ../docker-compose.yml build kezzle-api
  passed

docker compose -f ../docker-compose.yml up -d mongodb redis ai-server kezzle-api
  MongoDB healthy, Redis healthy, AI server running
  Nest application successfully started
  GET /metrics 200
```

## 최종 판정

Type-A~F 구조 구현과 review P1/P2 후속 보강, 실제 Mongo integration 검증이 모두 완료됐다. 계획서의 최종 완료 조건을 유지한다.
