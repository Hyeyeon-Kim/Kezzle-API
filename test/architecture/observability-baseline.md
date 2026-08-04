# Observability Phase F canonical architecture

> 측정일: 2026-08-04
> 기준 브랜치: `refactor/global-provider-observability-integration`
> canonical fixture: [`../fixtures/observability-baseline.contract.json`](../fixtures/observability-baseline.contract.json)

## 결론

애플리케이션의 Prometheus Registry, default collector, `/metrics` endpoint owner를 각각 하나로 통합했다. 19개 custom metric family의 이름·HELP/TYPE·label·histogram bucket은 유지했고, 중복 노출되던 prefix 없는 default metric 31개를 제거했다.

Home/Curation metric은 각각 feature-owned adapter가 소유한다. `AppModule`은 scrape endpoint만 import하며 feature metric provider를 전역 공급하지 않는다.

## Before / After

동일한 Docker network와 동일 dependency를 사용해 Phase A 커밋 `42a885a`와 Phase F runtime의 기동 직후 idle `/metrics`를 각각 측정했다.

| 항목                       |       Before |        After |                  변화 |
| -------------------------- | -----------: | -----------: | --------------------: |
| Registry object            |            2 |            1 |                    -1 |
| default collector 호출     |            2 |            1 |                    -1 |
| endpoint serialization     |            2 |            1 |                    -1 |
| custom metric family       |           19 |           19 |             유실 없음 |
| default metric family      |           62 |           31 |                   -31 |
| 전체 metric family         |           81 |           50 |          -31 (-38.3%) |
| duplicate family           |            0 |            0 |                  없음 |
| prefix 없는 default family |           31 |            0 |                  제거 |
| scrape payload             | 21,919 bytes | 13,050 bytes | -8,869 bytes (-40.5%) |

payload는 process counter 값의 자릿수에 따라 소폭 달라질 수 있다. 위 값은 두 격리 컨테이너의 첫 idle scrape를 같은 방식으로 측정한 값이다.

## Canonical dependency

```text
AppModule
  └─ PrometheusEndpointModule
       └─ PrometheusRegistryModule

AiSearchModule / CatalogQueryModule / SearchModule / LikeModule
  └─ PrometheusRegistryModule
       └─ feature-owned metric adapter

MediaObservabilityModule
  └─ PrometheusRegistryModule
       └─ MediaMetricsAdapter

CurationModule
  └─ PrometheusRegistryModule
       └─ CurationRefreshMetricsAdapter

HomeModule / HomeCacheModule
  └─ HomeObservabilityModule
       └─ PrometheusRegistryModule
            └─ PrometheusHomeMetricsAdapter
```

- production `@Global()` feature module: 0개
- production `new Registry()`: registry provider factory 1곳
- production `collectDefaultMetrics()`: registry provider factory 1곳
- prom-client global `register` 사용: 0곳
- `/metrics`의 `registry.metrics()` 호출: 1회
- legacy Metrics/Monitoring/HomeResilience provider: 0개

## Metric family ownership

| Owner     | Family 수 | Metric                                  |
| --------- | --------: | --------------------------------------- |
| AI Search |         2 | `ai_api_*`                              |
| Catalog   |         2 | `similar_search_*`, `store_query_*`     |
| Search    |         1 | `search_event_record_failures_total`    |
| Like      |         1 | `cake_like_event_record_failures_total` |
| Media     |         2 | `object_storage_*`, `media_object_*`    |
| Home      |         8 | `kezzle_home_*`                         |
| Curation  |         3 | `kezzle_curation_*`                     |

architecture gate는 19개 이름이 fixture의 owner 파일에 정확히 한 번만 선언되는지 검사한다. Home application port와 HomeFeed/HomeCache consumer는 `prom-client`, Registry token, concrete adapter를 참조할 수 없다.

## Prometheus rule과 Grafana query

- `promtool check rules`: recording 16개, alert 14개 유효
- `promtool test rules`: 10개 시나리오 성공
- Home dashboard PromQL: 28개 모두 Prometheus query API 실행 성공
- Home dashboard가 참조하는 API/recording metric: canonical fixture와 일치
- MongoDB/Redis exporter raw family: 6개 모두 실제 Prometheus TSDB에 존재
- `job:home_request_rate:rate1m`: rule health `ok`, 결과 series 생성 확인
- Grafana `/api/health`: database `ok`

## 실제 event 노출 계약

canonical `/metrics` e2e가 하나의 Registry와 endpoint에 다음 event sample을 동시에 생성하고 확인한다.

- Home request와 Home AI call
- AI API error
- Search event persistence failure
- Cake-like event persistence failure
- Object storage failure와 media orphan
- Curation refresh run/item/backlog

실제 Compose API에도 Home request를 보내 `kezzle_home_requests_total`과 Home recording series 생성을 확인했다.

## 반복 검증

| 검증                                | 결과                       |
| ----------------------------------- | -------------------------- |
| 전체 unit                           | 60 suites / 250 tests 통과 |
| 전체 e2e                            | 6 suites / 58 tests 통과   |
| architecture 본체                   | 2 suites / 28 tests 통과   |
| presenter architecture contract     | 2 suites / 11 tests 통과   |
| Nest build                          | 통과                       |
| 변경 TypeScript ESLint              | 통과                       |
| Prometheus rule check/test          | 통과                       |
| API/Prometheus/Grafana Compose boot | 통과                       |
| observability stack smoke           | 통과                       |

```bash
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run test:architecture
npm run build
promtool check rules
promtool test rules monitoring/rules/home-alert.rules.test.yml
npm run test:smoke:observability
```

모든 명령은 Docker builder/runtime 또는 Docker Compose service 안에서 실행한다.
