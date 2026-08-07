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

## 로컬 실행

Node.js `22.23.1`과 npm lockfile을 기준으로 합니다.

```bash
cp .env.example .env
npm ci
npm run start:dev
```

`.env.example`의 `replace-with-*` 값은 실제 Firebase/S3 설정으로 바꿔야 합니다. 환경 변수는 시작 시 검증되며 required 값이 없거나 URL·정수 형식이 잘못되면 앱이 즉시 종료됩니다. MongoDB는 필수이고 Redis는 선택 사항입니다.

전체 로컬 stack은 상위 `Kezzle` 디렉터리의 Compose 파일로 실행합니다.

```bash
docker compose up --build mongodb redis ai-server kezzle-api
```

관측성 stack까지 확인하려면 `prometheus`와 `grafana` service를 함께 실행합니다. 종료 시에는 `docker compose down`을 사용하며, Mongo/Grafana volume까지 삭제하려는 경우에만 의도적으로 `-v`를 추가합니다.

## 운영 확인

- `GET /health/live`: process liveness
- `GET /health/ready`: MongoDB·Redis dependency readiness (`Redis` 장애는 degraded)
- `GET /metrics`: Prometheus scrape endpoint
- `SIGTERM`: readiness를 먼저 내리고 drain 시간 후 graceful shutdown

Docker image는 multi-stage build와 non-root runtime을 사용합니다.

```bash
docker build -t kezzle-api:local .
docker run --rm --env-file .env \
  -e MONGODB_URL=mongodb://host.docker.internal:27017 \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -p 3000:3000 kezzle-api:local
```

위 `host.docker.internal` 예시는 macOS/Windows에서 host의 MongoDB·Redis를 사용할 때의 값입니다. 별도 Docker network에서 MongoDB·Redis·AI 서비스를 함께 사용할 때는 각 URL을 컨테이너 DNS 이름으로 지정해야 합니다. Compose는 이 값을 자동으로 덮어씁니다.

## 검증

```bash
npm run typecheck
npm run lint:check
npm run format:check
npm test -- --runInBand
npm run test:architecture
npm run test:e2e -- --runInBand
MONGODB_URL=mongodb://127.0.0.1:27017 npm run test:integration:mongo
```

E2E와 Mongo integration은 테스트 전용 database를 사용해야 하며 운영 database URL을 넘기지 않습니다.
