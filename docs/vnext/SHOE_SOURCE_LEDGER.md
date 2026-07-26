# 러닝봄 러닝화 출처 장부

## 데이터 버전

`SHOE_DATA_VERSION`은 `2026.07.26-v1`이다. 코드와 생성된 `data/shoes.json`에는 8개 브랜드의 8개 모델이 있다.

## 출처 목록

| 브랜드 | 모델 | 상태 | 공식 URL 범위 | 확인일 | 가격 |
|---|---|---|---|---|---|
| Nike | Pegasus 42 | available | Nike 한국 공식 제품 페이지 | 2026-07-26 | 미확인 `null` |
| adidas | Supernova Rise 2 | available | adidas 한국 공식 제품 페이지 | 2026-07-26 | 미확인 `null` |
| ASICS | GEL-NIMBUS 27 | global-only | ASICS 일본 공식 Nimbus 페이지 | 2026-07-26 | 미확인 `null` |
| New Balance | Fresh Foam X 1080v14 | global-only | New Balance 공식 제품 페이지 | 2026-07-26 | 미확인 `null` |
| HOKA | Clifton 10 | global-only | HOKA 공식 제품 페이지 | 2026-07-26 | 미확인 `null` |
| Mizuno | Wave Rider 29 | global-only | Mizuno 공식 발표 자료 | 2026-07-26 | 미확인 `null` |
| Saucony | Ride 18 | global-only | Saucony 공식 제품 페이지 | 2026-07-26 | 미확인 `null` |
| Brooks | Ghost 17 | global-only | Brooks 공식 제품 페이지 | 2026-07-26 | 미확인 `null` |

정확한 URL은 `apps/mobile/domains/shoes/catalog.ts`와 생성본 `data/shoes.json`에 보존돼 있다.

## 사실과 편집 정보의 분리

각 레코드는 다음을 분리한다.

- `officialFacts`는 공식 페이지에 근거한 사양 또는 제품군 정보다.
- `editorialSummary`는 러닝봄의 비교 설명이다.
- `consideration`은 구매 전 확인할 주의점이다.
- `koreaStatus`는 국내 공식 페이지 확인 또는 글로벌 정보만 확인된 상태다.
- `priceKrw`는 모두 `null`이며 가격을 추정하지 않는다.

## 이미지와 권리

현재 카탈로그에는 상품 이미지, 브랜드 로고, 외부 이미지 hotlink가 없다. 앱은 텍스트 중심으로 모델을 표시한다.

## finder

finder는 표면 일치에 3점, 거리 일치에 2점, 우선순위 일치에 3점을 부여하고 최대 3개를 반환한다. 동일 입력은 모델명 정렬을 이용해 같은 결과를 반환한다.

예산은 입력 계약에 포함돼 있지만 현재 점수에 사용되지 않는다. 따라서 예산 기반 추천으로 설명하면 안 된다.

## 자동 검증

`apps/mobile/tests/core-rules.test.ts`에서 다음을 확인했다.

- 브랜드가 8개인지 확인
- 모든 공식 URL이 HTTPS인지 확인
- 모든 가격이 `null`인지 확인
- 공식 사실 배열이 비어 있지 않은지 확인
- finder가 최대 3개를 결정적으로 반환하는지 확인

상태는 `PASS_TEST`다.

## 외부 확인 한계

이 문서 작성 과정에서는 8개 URL을 실시간으로 열어 HTTP 상태, 페이지 변경, 국내 판매 상태를 다시 검증하지 않았다. 실시간 링크 상태는 `NOT_RUN`이다.

`data/upcoming-shoes.json`의 레코드는 0건이다. 출시 예정 상품을 가짜로 채우지 않는다.
