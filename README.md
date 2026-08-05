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

## Prerequisites

- Docker Engine 또는 Docker Desktop
- Docker Compose v2 (`docker compose`)
- Kezzle 전체 local topology를 실행할 경우 상위 `Kezzle/docker-compose.yml`과 sibling AI directory
- 실제 API 부팅에 사용할 Firebase service account와 S3 bucket/region

로컬 Node.js와 `npm install`은 필수가 아닙니다. build, 실행, test는 Docker에서 수행합니다.

## 환경 변수 설정

저장소 root(`Kezzle-API`)에서 example을 복사한 뒤 required placeholder를 실제 개발용 값으로 교체합니다.

```bash
cp .env.example .env
```

`.env`에는 `KEY = value`처럼 key 주변에 공백을 넣지 마십시오. Docker `--env-file`과 Compose parser가 서로 다르게 처리할 수 있습니다.

### Firebase private key

Firebase private key는 한 줄의 quoted value로 저장하고 실제 newline을 `\n`으로 표현합니다.

```dotenv
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nreplace-with-service-account-private-key\n-----END PRIVATE KEY-----"
```

애플리케이션 config가 `\n`을 실제 newline으로 변환합니다. service account JSON, private key, AWS credential, `.env`는 commit하지 않습니다. `.gitignore`와 `.dockerignore`는 local env와 credential file을 제외하며 `.env.example`만 placeholder 문서로 허용합니다.

### Required, optional, default 계약

`paired` 변수는 두 값을 함께 설정하거나 둘 다 비워야 합니다. `없음`은 자동 default가 없다는 의미입니다.

#### App과 MongoDB

| 변수                  | 요구     | default | 설명                                                 |
| --------------------- | -------- | ------- | ---------------------------------------------------- |
| `NODE_ENV`            | required | 없음    | `development`, `test`, `production` 중 하나          |
| `PORT`                | optional | `3000`  | API listen port                                      |
| `SHUTDOWN_DRAIN_MS`   | optional | `1000`  | SIGTERM 후 readiness를 내린 상태로 유지할 drain 시간 |
| `MONGODB_URL`         | required | 없음    | `mongodb:` 또는 `mongodb+srv:` URL                   |
| `MONGODB_DBNAME_MAIN` | required | 없음    | main database name                                   |
| `MONGODB_USERNAME`    | paired   | 없음    | Mongo username                                       |
| `MONGODB_PASSWORD`    | paired   | 없음    | Mongo password                                       |

#### Auth, Firebase, storage와 AI

| 변수                            | 요구     | default                           | 설명                                                     |
| ------------------------------- | -------- | --------------------------------- | -------------------------------------------------------- |
| `DEVELOPMENT_AUTH_BYPASS`       | optional | `false`                           | development 전용 auth bypass; production에서는 금지      |
| `HOME_RESILIENCE_AUTH_BYPASS`   | optional | `false`                           | home resilience smoke 전용 bypass; production에서는 금지 |
| `HOME_RESILIENCE_USER_ID`       | optional | `home-resilience-user`            | home smoke user ID                                       |
| `HOME_RESILIENCE_CAKE_LIKE_IDS` | optional | 빈 문자열                         | comma-separated cake IDs                                 |
| `FIREBASE_PROJECT_ID`           | required | 없음                              | Firebase project ID                                      |
| `FIREBASE_PRIVATE_KEY`          | required | 없음                              | `\n`으로 newline을 표현한 PEM private key                |
| `FIREBASE_CLIENT_EMAIL`         | required | 없음                              | Firebase service account email                           |
| `A_BUCKET_NAME`                 | required | 없음                              | S3 bucket name                                           |
| `A_REGION`                      | required | 없음                              | AWS region                                               |
| `A_ACCESS_KEY_ID`               | paired   | 없음                              | optional static AWS credential                           |
| `A_SECRET_ACCESS_KEY`           | paired   | 없음                              | optional static AWS credential                           |
| `VIT_API_BASE_URL`              | optional | `https://api.kezzlecake.com/vit`  | VIT API base URL                                         |
| `CLIP_API_BASE_URL`             | optional | `https://api.kezzlecake.com/clip` | CLIP API base URL                                        |
| `AI_HTTP_TIMEOUT_MS`            | optional | `5000`                            | 공통 AI HTTP timeout                                     |

#### Home과 Redis cache

| 변수                                    | 요구     | default   | 설명                                       |
| --------------------------------------- | -------- | --------- | ------------------------------------------ |
| `REDIS_URL`                             | optional | 없음      | 미설정 시 cache disabled; 장애 시 degraded |
| `HOME_CACHE_COMMAND_TIMEOUT_MS`         | optional | `80`      | Redis command timeout                      |
| `HOME_CACHE_CONNECT_TIMEOUT_MS`         | optional | `1000`    | Redis connect timeout                      |
| `HOME_CACHE_LOCK_TTL_MS`                | optional | `10000`   | stale refresh lock TTL                     |
| `HOME_CACHE_TTL_JITTER_PERCENT`         | optional | `10`      | fresh TTL jitter, 0–100                    |
| `HOME_HARD_DEADLINE_MS`                 | optional | `600`     | 전체 Home hard deadline                    |
| `HOME_RECOMMEND_TIMEOUT_MS`             | optional | `250`     | recommend section timeout                  |
| `HOME_ANNIVERSARY_TIMEOUT_MS`           | optional | `250`     | anniversary section timeout                |
| `HOME_POPULAR_TIMEOUT_MS`               | optional | `50`      | popular section timeout                    |
| `HOME_KEYWORD_RANKS_TIMEOUT_MS`         | optional | `400`     | keyword rank section timeout               |
| `HOME_NEWEST_TIMEOUT_MS`                | optional | `100`     | newest section timeout                     |
| `HOME_CURATIONS_TIMEOUT_MS`             | optional | `100`     | curation section timeout                   |
| `HOME_RESILIENCE_METRICS_ENABLED`       | optional | `false`   | structured Home JSON metric log            |
| `HOME_CACHE_ANNIVERSARY_FRESH_TTL_MS`   | optional | `300000`  | anniversary fresh TTL                      |
| `HOME_CACHE_ANNIVERSARY_STALE_TTL_MS`   | optional | `1800000` | anniversary stale TTL                      |
| `HOME_CACHE_RECOMMEND_FRESH_TTL_MS`     | optional | `600000`  | recommend fresh TTL                        |
| `HOME_CACHE_RECOMMEND_STALE_TTL_MS`     | optional | `3600000` | recommend stale TTL                        |
| `HOME_CACHE_POPULAR_FRESH_TTL_MS`       | optional | `60000`   | popular fresh TTL                          |
| `HOME_CACHE_POPULAR_STALE_TTL_MS`       | optional | `600000`  | popular stale TTL                          |
| `HOME_CACHE_KEYWORD_RANKS_FRESH_TTL_MS` | optional | `60000`   | keyword ranks fresh TTL                    |
| `HOME_CACHE_KEYWORD_RANKS_STALE_TTL_MS` | optional | `600000`  | keyword ranks stale TTL                    |
| `HOME_CACHE_NEWEST_FRESH_TTL_MS`        | optional | `60000`   | newest fresh TTL                           |
| `HOME_CACHE_NEWEST_STALE_TTL_MS`        | optional | `600000`  | newest stale TTL                           |
| `HOME_CACHE_CURATIONS_FRESH_TTL_MS`     | optional | `300000`  | curations fresh TTL                        |
| `HOME_CACHE_CURATIONS_STALE_TTL_MS`     | optional | `1800000` | curations stale TTL                        |

#### Ranking과 Curation

| 변수                              | 요구     | default     | 설명                                         |
| --------------------------------- | -------- | ----------- | -------------------------------------------- |
| `KEYWORD_RANK_WINDOW_DAYS`        | optional | `30`        | keyword event aggregation window             |
| `POPULAR_RANK_WINDOW_DAYS`        | optional | `30`        | popular event aggregation window             |
| `KEYWORD_RANK_TTL_MS`             | optional | `600000`    | keyword rank read model TTL                  |
| `POPULAR_RANK_TTL_MS`             | optional | `600000`    | popular rank read model TTL                  |
| `POPULAR_RANK_SOURCE_MAX_TIME_MS` | optional | `5000`      | popular source aggregate maxTimeMS           |
| `CURATION_REFRESH_INTERVAL_MS`    | optional | `600000`    | refresh interval; `0`이면 scheduler disabled |
| `CURATION_STALE_MS`               | optional | `259200000` | curation stale threshold                     |

잘못된 boolean, integer, URL, pair 또는 required 값은 network/listen 전에 변수 이름을 포함한 오류로 종료됩니다.

## Docker build와 실행

아래 명령은 `Kezzle-API` root에서 실행합니다. `-p kezzle`로 Compose project와 test network 이름을 고정합니다.

### Production image build

```bash
docker build -t kezzle-api:local .
```

### 최소 local boot

MongoDB와 Redis만 먼저 올리고 AI server dependency는 건너뜁니다. AI endpoint를 호출하지 않는 boot·health 검증용입니다.

```bash
docker compose -p kezzle -f ../docker-compose.yml up -d mongodb redis
docker compose -p kezzle -f ../docker-compose.yml up -d --build --no-deps kezzle-api
docker compose -p kezzle -f ../docker-compose.yml ps
```

### 전체 local topology

```bash
docker compose -p kezzle -f ../docker-compose.yml up -d --build
```

일반 종료는 `docker kill` 대신 Compose stop을 사용해 SIGTERM과 termination grace를 적용합니다.

```bash
docker compose -p kezzle -f ../docker-compose.yml stop kezzle-api
```

volume을 삭제하는 `docker compose down -v`는 local data 삭제 의도가 있을 때만 사용합니다.

## Local Compose topology와 port

| Service          | Container port | Host port | 비고                            |
| ---------------- | -------------: | --------: | ------------------------------- |
| Kezzle API       |           3000 |      3000 | Nest API와 operational endpoint |
| MongoDB          |          27017 |     27017 | required persistence            |
| Redis            |           6379 |      6379 | optional Home cache             |
| AI server        |           8001 |      8001 | VIT/CLIP local integration      |
| MongoDB exporter |           9216 |      9216 | Prometheus scrape target        |
| Redis exporter   |           9121 |      9121 | Prometheus scrape target        |
| Prometheus       |           9090 |      9090 | metric/query/rule UI            |
| Grafana          |           3000 |      3001 | dashboard UI                    |

`faiss-builder`는 `build` profile의 one-shot index builder이며 host port를 열지 않습니다.

## Operational endpoint

| URL                                                 | 인증 | 정상 계약             | 용도                         |
| --------------------------------------------------- | ---- | --------------------- | ---------------------------- |
| [Swagger](http://localhost:3000/api-docs)           | 없음 | 200                   | API schema와 request 확인    |
| [Prometheus metrics](http://localhost:3000/metrics) | 없음 | 200                   | application metric scrape    |
| [Liveness](http://localhost:3000/health/live)       | 없음 | `200 {"status":"ok"}` | process/event loop 생존 확인 |
| [Readiness](http://localhost:3000/health/ready)     | 없음 | 200 또는 503          | traffic 수용 가능 여부       |

Docker 내부에서 health 계약을 확인할 수 있습니다.

```bash
docker exec kezzle-api node -e "fetch('http://127.0.0.1:3000/health/live').then(async (response) => { console.log(response.status, await response.text()); if (!response.ok) process.exit(1); }).catch((error) => { console.error(error.message); process.exit(1); })"
docker exec kezzle-api node -e "fetch('http://127.0.0.1:3000/health/ready').then(async (response) => { console.log(response.status, await response.text()); if (!response.ok) process.exit(1); }).catch((error) => { console.error(error.message); process.exit(1); })"
```

Readiness 결과는 다음과 같습니다.

- `200 ok`: lifecycle ready, Mongo up, Redis up 또는 disabled
- `200 degraded`: lifecycle ready, Mongo up, configured Redis down
- `503 unavailable`: booting, shutdown 시작 또는 Mongo down

## Docker 기반 test

먼저 dev dependency를 포함한 공통 builder image와 Docker Mongo를 준비합니다.

```bash
docker build --target builder -t kezzle-api:test .
docker compose -p kezzle -f ../docker-compose.yml up -d mongodb
```

### Unit

```bash
docker run --rm \
  -v "$PWD/src:/app/src:ro" \
  -v "$PWD/test:/app/test:ro" \
  -v "$PWD/monitoring:/app/monitoring:ro" \
  kezzle-api:test npm test -- --runInBand
```

### E2E

```bash
docker run --rm --network kezzle_default \
  -e MONGODB_URL=mongodb://mongodb:27017 \
  -v "$PWD/src:/app/src:ro" \
  -v "$PWD/test:/app/test:ro" \
  kezzle-api:test npm run test:e2e -- --runInBand --detectOpenHandles
```

### Architecture와 presenter gate

```bash
docker run --rm \
  -v "$PWD/src:/app/src:ro" \
  -v "$PWD/test:/app/test:ro" \
  -v "$PWD/monitoring:/app/monitoring:ro" \
  -v "$PWD/Dockerfile:/app/Dockerfile:ro" \
  -v "$PWD/README.md:/app/README.md:ro" \
  -v "$PWD/.env.example:/app/.env.example:ro" \
  -v "$PWD/.gitignore:/app/.gitignore:ro" \
  -v "$PWD/.dockerignore:/app/.dockerignore:ro" \
  kezzle-api:test npm run test:architecture
```

### Mongo integration

```bash
docker run --rm --network kezzle_default \
  -e MONGODB_URL=mongodb://mongodb:27017 \
  -v "$PWD/src:/app/src:ro" \
  -v "$PWD/test:/app/test:ro" \
  kezzle-api:test npm run test:integration:mongo
```

## Fake Firebase/S3 full-app E2E 경계

`test/full-app-provider-overrides.contract.e2e-spec.ts`는 실제 `AppModule`을 compile하되 다음 provider만 fake로 override합니다.

- `FirebaseAppProvider`, `FIREBASE_APP`, `FIREBASE_AUTH_CLIENT`, `FirebaseTokenVerifier`
- `S3_STORAGE_CONFIG`, `S3_CLIENT`, `ObjectStoragePort`

따라서 Firebase credential이나 Firebase/S3 network 없이 인증·storage wiring과 cleanup을 검증하며, production module은 실제 adapter를 유지합니다.

```bash
docker run --rm --network kezzle_default \
  -e MONGODB_URL=mongodb://mongodb:27017 \
  -v "$PWD/src:/app/src:ro" \
  -v "$PWD/test:/app/test:ro" \
  kezzle-api:test npm run test:e2e:full-app -- --detectOpenHandles
```

## Readiness와 graceful shutdown 운영 절차

1. 배포 대상은 `/health/ready`가 200이 된 뒤 traffic에 포함합니다.
2. SIGTERM을 받으면 lifecycle이 `shutting-down`으로 바뀌고 readiness가 즉시 503이 됩니다.
3. `SHUTDOWN_DRAIN_MS` 동안 load balancer가 새 traffic을 제외할 시간을 둡니다.
4. drain 후 HTTP server, Redis client/listener, scheduler interval, Mongo connection과 Firebase app을 정리합니다.
5. Compose `stop_grace_period`는 15초입니다. drain과 처리 중인 request의 최대 시간을 합친 값보다 항상 길게 유지합니다.

종료 상태는 다음 명령으로 확인합니다.

```bash
docker compose -p kezzle -f ../docker-compose.yml logs --tail=200 kezzle-api
docker inspect --format 'status={{.State.Status}} exit={{.State.ExitCode}} error={{json .State.Error}}' kezzle-api
```

정상 종료 로그에는 `state=shutting-down`, `draining traffic before shutdown`이 남고 container exit code는 0입니다.

## 주요 장애 확인 순서

1. `docker compose -p kezzle -f ../docker-compose.yml ps`에서 API와 required Mongo health를 확인합니다.
2. `/health/live`로 process 생존을, `/health/ready`의 `lifecycle`, `mongo`, `redis` check로 traffic 가능 여부를 확인합니다.
3. 부팅 실패 시 `docker compose -p kezzle -f ../docker-compose.yml logs --tail=200 kezzle-api`에서 `Invalid environment configuration`과 변수 이름을 먼저 확인합니다.
4. Mongo 장애는 readiness 503 원인입니다. Redis 장애는 200 degraded이며 Home cache가 origin fallback으로 동작하는지 확인합니다.
5. Firebase 401은 verifier log, S3 upload/delete는 structured storage log, AI timeout/error는 dependency log와 metric을 확인합니다.
6. `/metrics`와 [Prometheus targets](http://localhost:9090/targets)에서 scrape 상태를 확인하고 [Grafana](http://localhost:3001) dashboard로 Home/API 추이를 확인합니다.

주요 metric family는 다음과 같습니다.

- Home: `kezzle_home_requests_total`, `kezzle_home_section_requests_total`, `kezzle_home_cache_events_total`
- AI/catalog: `ai_api_call_duration_seconds`, `ai_api_errors_total`, `similar_search_duration_seconds`
- Event: `search_event_record_failures_total`, `cake_like_event_record_failures_total`
- Media: `object_storage_operation_failures_total`, `media_object_orphans_total`
- Curation: `kezzle_curation_refresh_runs_total`, `kezzle_curation_stale_backlog`

실제 secret이 노출됐다고 의심되면 먼저 credential을 폐기·회전하고, Git history나 image layer 정리가 필요한지는 별도로 판단합니다. secret 값을 issue, PR, log, screenshot 또는 test fixture에 붙이지 마십시오.
