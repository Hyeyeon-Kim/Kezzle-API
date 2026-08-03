# Observability Phase A architecture baseline

> 측정일: 2026-08-03  
> 기준 브랜치: `refactor/global-provider-observability-integration`  
> fixture: [`../fixtures/observability-baseline.contract.json`](../fixtures/observability-baseline.contract.json)

## 결론

현재 애플리케이션은 `MetricsService`와 `MonitoringService`가 서로 다른 Prometheus `Registry`를 소유한다. 두 service 모두 `collectDefaultMetrics()`를 호출하고 `/metrics` controller가 두 결과를 문자열로 합친다.

`HomeCacheModule`과 `HomeResilienceMetricsModule`은 이미 non-global이다. `MonitoringModule`만 `@Global()`이며, 이 전역성 때문에 `HomeResilienceMetricsModule`과 `CurationModule`의 실제 `MonitoringService` 의존이 module `imports`에 나타나지 않는다.

## Registry 기준선

| Owner               | Registry      | default prefix | custom family 수 |
| ------------------- | ------------- | -------------- | ---------------: |
| `MetricsService`    | 독립 instance | 없음           |                8 |
| `MonitoringService` | 독립 instance | `kezzle_`      |               11 |

default metric은 같은 Node process를 관측하지만 prefix 유무만 다른 27개 family가 각각 등록된다.

```text
process_* / nodejs_*
kezzle_process_* / kezzle_nodejs_*
```

Phase B 이후 canonical default contract는 repository Home dashboard/alert가 사용하는 `kezzle_` 계열이다. Phase A는 제거하지 않고 현재 중복을 characterization test로 고정한다.

## Custom metric owner 기준선

| 현재 owner          | Metric group                              | 실제 consumer                     |
| ------------------- | ----------------------------------------- | --------------------------------- |
| `MetricsService`    | `ai_api_*`                                | VIT/CLIP client                   |
| `MetricsService`    | `similar_search_*`, `store_query_*`       | Catalog similar query             |
| `MetricsService`    | `search_event_record_failures_total`      | Search                            |
| `MetricsService`    | `cake_like_event_record_failures_total`   | Like                              |
| `MetricsService`    | `object_storage_operation_failures_total` | S3 adapter                        |
| `MetricsService`    | `media_object_orphans_total`              | Cake/Store media use case         |
| `MonitoringService` | `kezzle_home_*`                           | HomeFeed/HomeCache/HomeResilience |
| `MonitoringService` | `kezzle_curation_*`                       | Curation refresh                  |

계획서 최초 작성 후 Log·Upload Phase H에서 object-storage/media metric 2종과 Cake/Store/ObjectStorage의 `MetricsModule` import가 추가됐다. Phase A fixture는 계획서의 초기 목록이 아니라 현재 production source 전체를 기준으로 한다.

## Module import 기준선

### Global

```text
MonitoringModule (@Global)
```

### MonitoringModule 명시적 consumer

```text
AppModule
HomeModule
```

### MetricsModule 명시적 consumer

```text
AiSearchModule
CakeModule
CatalogQueryModule
LikeModule
MonitoringModule
ObjectStorageModule
SearchModule
StoreModule
```

### 숨은 MonitoringService consumer

| Module                        | Provider                       | 현재 상태                                   |
| ----------------------------- | ------------------------------ | ------------------------------------------- |
| `HomeResilienceMetricsModule` | `HomeResilienceMetricsService` | inject하지만 `MonitoringModule` import 없음 |
| `CurationModule`              | `CurationRefreshService`       | inject하지만 `MonitoringModule` import 없음 |

`HomeFeedService`도 `MonitoringService`를 사용하지만 `HomeModule`이 MonitoringModule을 명시적으로 import하므로 숨은 consumer에는 포함하지 않는다.

## Repository metric consumer

정확한 metric/recording-rule token 목록은 JSON fixture가 소유하며 test가 다음 파일을 다시 스캔해 drift를 검출한다.

- `monitoring/rules/home-recording.rules.yml`
- `monitoring/rules/home-alert.rules.yml`
- `monitoring/rules/home-alert.rules.test.yml`
- `monitoring/grafana/dashboards/home-api.json`
- `monitoring/grafana/provisioning/dashboards/similar-search.json`

## `/metrics` HTTP 기준선

```text
GET /metrics
status: 200
auth: @Public(), credential 불필요
Cache-Control: no-store
Content-Type: Prometheus text format
body: MonitoringService registry + newline + MetricsService registry
```

e2e의 default-deny test guard는 `@Public()` metadata가 없으면 요청을 거부한다. 따라서 anonymous 200은 전역 auth 구성을 생략한 단순 controller test가 아니라 public metadata 계약을 함께 검증한다.

## Prometheus scrape smoke

재현 명령:

```bash
docker compose -f ../docker-compose.yml up -d prometheus
npm run test:smoke:prometheus
```

smoke는 Prometheus `/api/v1/targets`에서 다음을 검증한다.

- `job=kezzle-api` active target 존재
- `health=up`
- scrape URL이 `/metrics`로 끝남
- `lastError`가 비어 있음

2026-08-03 실제 실행 결과:

```json
{
  "prometheusUrl": "http://127.0.0.1:9090",
  "job": "kezzle-api",
  "health": "up",
  "scrapeUrl": "http://kezzle-api:3000/metrics",
  "lastError": "",
  "lastScrape": "2026-08-03T08:13:35.091501548Z"
}
```

Compose가 기존 `kezzle-api` container를 재생성한 뒤 Prometheus target이 첫 정상 scrape를 완료했다. Redis exporter는 arm64 host에서 amd64 image warning을 출력했지만 `kezzle-api` target 검증에는 영향을 주지 않았다.

## 자동 검증

```bash
npm test -- --runInBand observability-baseline.spec.ts
npm run test:e2e -- --runInBand observability-baseline.contract.e2e-spec.ts
npm run test:architecture
npm run build
npm run test:smoke:prometheus
```
