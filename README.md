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
