# Kezzle API

Kezzle의 케이크·매장 탐색, 유사 이미지 검색, 좋아요, 큐레이션, 랭킹과 홈 feed를 제공하는 NestJS API입니다. MongoDB를 required persistence로 사용하고 Redis cache, Firebase Authentication, S3 object storage, VIT/CLIP AI API를 외부 integration으로 사용합니다.

## 주요 module과 integration

| 영역                      | 책임                                                              |
| ------------------------- | ----------------------------------------------------------------- |
| Cake / Store / User       | 핵심 entity 조회·쓰기와 feature별 persistence mapping             |
| Catalog / Search / Like   | 케이크·매장 catalog, 검색 history/event, 사용자 좋아요            |
| Curation / Ranking / Home | 큐레이션 refresh, keyword/popular read model, resilient home feed |
| Media                     | Cake/Store media use case, S3 adapter, 보상 삭제와 orphan 관측    |
| Auth                      | Firebase token verifier와 role/self authorization                 |
| Health / Observability    | live/ready 상태, Prometheus metric, Grafana dashboard             |

외부 dependency 정책은 다음과 같습니다.

- MongoDB: required. 연결되지 않으면 앱 부팅 또는 readiness가 실패합니다.
- Redis: optional. 연결되지 않아도 원본 조회로 동작하며 readiness는 `200 degraded`입니다.
- Firebase: 실제 앱에서는 service account로 초기화합니다. 테스트에서는 fake verifier로 교체합니다.
- S3: 실제 앱에서는 AWS adapter를 사용합니다. 테스트에서는 fake client/object storage로 교체합니다.
- VIT/CLIP: 모든 호출에 공통 HTTP timeout과 caller `AbortSignal`을 전달합니다.

## 인증·권한 정책

모든 controller route는 전역 `FirebaseAuthGuard`와 `RolesGuard`의 default-deny 경계를 통과합니다. 아래 표는 `test/fixtures/route-auth-matrix.contract.json`의 39개 route × 6개 principal 계약을 같은 정책 단위로 요약한 것입니다. fixture에 등록되지 않은 신규 route는 e2e coverage gate를 통과할 수 없습니다.

| Matrix 정책                | Route                                                                                                           | 권한·소유권 계약                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `public`                   | `POST /users`, `GET /search/rank`, `GET /curation/:id`, `GET /health/live`, `GET /health/ready`, `GET /metrics` | 인증 없이 허용                  |
| `roles:admin`              | `GET /users`, `POST /stores`, `POST /curation`                                                                  | ADMIN만 허용                    |
| `self-or-admin`            | `GET·PATCH·DELETE /users/:id`                                                                                   | 본인 또는 ADMIN                 |
| `roles:buyer,admin+self`   | `GET /users/:id/liked-cakes`, `GET /users/:id/liked-stores`                                                     | BUYER 본인 또는 ADMIN           |
| `roles:buyer`              | cake/store likes의 `POST·DELETE`                                                                                | BUYER principal 기준            |
| `roles:all`                | cake/store 조회, `GET /curation`                                                                                | ADMIN, SELLER, BUYER            |
| `roles:seller,admin+owner` | cake 수정·삭제, store cake import, store 수정·삭제·이미지 upload/delete                                         | store owner인 SELLER 또는 ADMIN |
| `authenticated-any`        | `GET /search`                                                                                                   | role 제한 없이 인증 필요        |
| `authenticated-any+self`   | `GET /search/:id`                                                                                               | 본인 또는 ADMIN이며 인증 필요   |

protected route의 anonymous 요청은 `401`, role 밖 principal은 `403`, ownership route의 other principal은 `403`으로 고정합니다.

## 업로드 제한과 파일 검증

Multer memory storage가 파일 전체를 buffer에 보관하므로 모든 upload interceptor는 공통 options factory를 통해 유한한 `limits.fileSize`와 파일 개수 제한을 적용합니다.

| 입력 경로                              | Field         |          파일당 최대 크기 | 최대 개수 |
| -------------------------------------- | ------------- | ------------------------: | --------: |
| `PATCH /cakes/:id`                     | `file` 이미지 | 10 MiB (10,485,760 bytes) |         1 |
| `PATCH /stores/:id/uploads/logo`       | `file` 이미지 | 10 MiB (10,485,760 bytes) |         1 |
| `PATCH /stores/:id/uploads/storeimage` | `file` 이미지 | 10 MiB (10,485,760 bytes) |         1 |
| `POST /stores/:id/cakes`               | `image`       |   5 MiB (5,242,880 bytes) |     3,000 |
| `POST /stores/:id/cakes`               | `excel`       |   5 MiB (5,242,880 bytes) |         1 |

Cake import는 하나의 multipart request에 Multer의 공통 `fileSize`가 적용되므로 image와 XLSX 모두 더 엄격한 5 MiB 제한을 사용합니다. 전체 파일 개수 상한은 3,001개입니다.

허용 MIME은 다음과 같습니다.

- 이미지: `image/jpeg`, `image/png`, `image/webp`
- Excel: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (`.xlsx`)

`fileFilter`는 allowlist 밖의 client MIME을 먼저 거부합니다. 통과한 파일도 application validator가 magic byte와 확장자·선언 MIME의 일치를 다시 검사하며, S3에는 시그니처로 확정된 canonical `ContentType`만 전달합니다. SVG, HTML, 실행 파일, 위장 파일은 허용하지 않습니다.

| 상황                               |                  HTTP status | 기본 message                                 |
| ---------------------------------- | ---------------------------: | -------------------------------------------- |
| 파일당 크기 제한 초과              |      `413 Payload Too Large` | `File too large`                             |
| MIME allowlist 밖                  | `415 Unsupported Media Type` | `Unsupported upload media type`              |
| magic byte·확장자·선언 MIME 불일치 | `415 Unsupported Media Type` | `File content does not match its media type` |
