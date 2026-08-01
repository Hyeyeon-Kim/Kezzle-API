# Type-B Image와 persistence schema 분리 결과

> 완료일: 2026-07-20
> 상태: 완료
> 라벨: `type: refactor`, `area: db`, `priority: p1`, `size: M`
> 상위 계획: [`8_persistence_application_api_타입_분리_작업_계획서.md`](./8_persistence_application_api_타입_분리_작업_계획서.md)

## 결과

Image를 persistence/application/API 세 계층 타입으로 분리하고 Cake·Store·Upload 사용처를 새 경계로 전환했다. Mongo field와 API JSON은 기존 `converte_name`을 유지하고 application에서만 `converteName`을 사용한다.

```text
ImageEmbedded (Mongo: converte_name)
        ↓ ImageMapper.toValue
ImageValue (application: converteName)
        ↓ ImageDto
ImageDto (API: converte_name)
```

기존 `upload/entities/image.Schema.ts`, `Image-request.dto.ts`, `Image-response.dto.ts`는 제거했다. 대소문자가 섞인 legacy file path도 함께 없어졌으며 Mongo collection/field에는 영향을 주지 않는다.

## 구현 범위

### Shared Image

- `src/common/image/application/image.value.ts`
  - framework import가 없는 readonly `ImageValue`
- `src/common/image/persistence/image.schema.ts`
  - `_id: false`인 `ImageEmbedded`와 `ImageEmbeddedSchema`
- `src/common/image/api/image.dto.ts`
  - Swagger와 validation을 소유하는 `ImageDto`
- `src/common/image/image.mapper.ts`
  - `converte_name`과 `converteName`의 양방향 명시 mapping

Cake와 Store schema는 `ImageEmbeddedSchema`만 사용한다. Cake/Store API DTO는 `ImageDto`만 사용하며 persistence schema class를 import하지 않는다.

### Upload와 write path

`UploadService.create()`는 API DTO 대신 pure `ImageValue`를 반환한다. Cake create path는 `ImageMapper.toPersistence()`로 Mongo 저장 shape를 만들며 Cake/Store image update DTO는 `ImageValue`를 API/Mongo key shape로 변환한다.

### Curation snapshot

`CurationCakeSnapshot`과 `CurationCakeSnapshotSchema`를 추가했다. Type-A에서 확인한 다음 key는 typed field로 casting한다.

```text
id
image
owner_store_id
cursor
tag_ins
user_like_ids
score
```

AI 응답에 추가 key가 생기거나 legacy snapshot에 모르는 key가 있어도 삭제하지 않도록 nested schema에 `_id: false`, `strict: false`를 적용했다. `image`는 현재 AI fixture가 `s3Url`만 포함할 수 있으므로 `Mixed`로 유지한다. Type-A fixture의 `legacy_extra`가 새 schema hydrate/toObject 후에도 보존됨을 확인했다.

## 계약 호환성

- Mongo/API Image key: `name`, `converte_name`, `key`, `s3Url` 유지
- Store optional logo: `null` 유지
- Store detail images: empty array 유지
- embedded Image 자동 `_id`: 생성하지 않음
- Curation cake snapshot 추가 key: 보존
- DB migration: 없음

총 19개 read route fixture와 representative Cake/Store/User/Curation legacy document fixture가 변경 전과 동일하게 통과했다.

## Import 기준선 변화

| 경계 | Type-A | Type-B |
| --- | ---: | ---: |
| Persistence schema → DTO import | 2 | 0 |
| DTO → persistence schema import | 4 | 0 |
| application/service → `Document` 결합 | 12줄 | 12줄 |
| application service → DTO import | 36줄 | 35줄 |

Type-B 목표인 persistence/API Image 역방향 의존은 모두 제거했다. 남은 `Document`와 service DTO 결합은 Type-C~F 범위다. `UploadService`의 API DTO import 제거로 service DTO 기준선은 한 줄 줄었다.

## 검증 결과

모든 검증은 Docker에서 실행했다.

```text
npm test -- --runInBand
  39 suites, 167 tests passed

npm run test:e2e -- --runInBand
  3 suites, 44 tests passed

npm run test:architecture
  1 suite, 5 tests passed

npm run build
  passed

docker compose -f docker-compose.yml build kezzle-api
  passed

docker compose -f docker-compose.yml up -d --no-build mongodb redis ai-server kezzle-api
  Nest application successfully started
```

## Type-C 전달 사항

- repository mapper는 `ImageMapper.toValue()`를 사용해 pure Cake/Store view에 `ImageValue`를 제공한다.
- write command는 `ImageValue`를 사용하고 persistence 직전에만 `toPersistence()`를 호출한다.
- API presenter는 `ImageDto`를 생성하며 Mongo schema class를 참조하지 않는다.
- Curation snapshot의 `strict: false` 추가 key 보존 정책과 Type-A round-trip fixture를 유지한다.
