# 러닝화 데이터 갱신 방법 (1페이지)

러닝화 카탈로그(`apps/mobile/domains/shoes/catalog.ts`)를 안전하게 최신 상태로 유지하는 절차입니다.

## 0. 원칙

- **외부 사이트를 크롤링하지 않습니다.** 약관·차단 위험이 있어 자동 수집은 하지 않고,
  "사람이 공식 페이지에서 확인할 목록"만 자동으로 뽑습니다.
- **모르는 값은 비웁니다.** 무게·드롭·스택높이·정확한 판매가는 필드로 만들지 않습니다.
  가격은 `priceBand`(엔트리/미들/하이/프리미엄)로만 안내합니다.
- **"최저가" 같은 단정 표현과 해외몰 링크는 쓰지 않습니다.**
- `keyTech`는 브랜드가 공식적으로 쓰는 폼·플레이트 이름만 넣고, 확신이 없으면 빈 배열로 둡니다.

## 1. 자동 점검 (주 1회)

`.github/workflows/refresh-shoe-data.yml`이 매주 월요일 KST 08:20에 돕니다.
`workflow_dispatch`로 수동 실행도 됩니다.

하는 일

1. `scripts/refresh-shoe-data.mjs`로 무결성 검사
   - 중복 `id`
   - 잘못된 `category` × `subCategory` 조합, 플레이트 분류 모순
   - 끊어진 `comparedTo` 참조, 자기 자신 참조
   - 금지 수치 필드(`weightGram`, `dropMm`, `stackMm`, `priceKrw`, `releaseDate`) 존재 여부
   - 금지 문자열(`최저가`, `해외직구`, `병행수입`, `정품 보장`) — 데이터와 `domains/shoes/**` 소스 양쪽
   - 심화 필드(`useCase`, `fitNote`, `bestForRunner`, `notFor`, `keyTech`, `comparedTo`) 누락
2. 검증 실패 시 워크플로 실패 (exit 1)
3. `apps/mobile` 단위 테스트 실행
4. `data/shoe-verification-queue.json` 갱신
5. 변경이 있으면 **PR 생성**(main 직접 push 안 함). 변경이 없으면 조용히 종료

## 2. 로컬에서 돌리기

```bash
# 저장소 루트에서 실행합니다. tsx는 apps/mobile devDependency에 있습니다.
npm --prefix apps/mobile ci

# 검사만 (파일을 쓰지 않음)
node --import ./apps/mobile/node_modules/tsx/dist/loader.mjs scripts/refresh-shoe-data.mjs

# 큐 파일까지 반영
node --import ./apps/mobile/node_modules/tsx/dist/loader.mjs scripts/refresh-shoe-data.mjs --write

# 큐 크기 조정 (기본 15)
node --import ./apps/mobile/node_modules/tsx/dist/loader.mjs scripts/refresh-shoe-data.mjs --top 25
```

표준 출력은 그대로 GitHub 이슈/PR 본문에 붙여 넣을 수 있는 markdown입니다.

## 3. 확인 큐 읽는 법

`data/shoe-verification-queue.json`

| 필드 | 뜻 |
| --- | --- |
| `totals.pending` | `verification`이 `chart-2026-05`인, 즉 아직 공식 확인이 안 된 러닝화 수 |
| `queue[].priority` | 낮을수록 먼저 확인. 대회화·플레이트 계열(오해 소지가 큼)이 1순위 |
| `queue[].keyTechKnown` | 공식 기술명이 이미 채워져 있는지 |
| `policy.checklist` | 공식 페이지에서 확인할 항목 |

## 4. 사람이 확인한 뒤 반영하는 절차

1. 큐의 러닝화를 브랜드 **공식 페이지**에서 확인합니다.
2. 확인된 항목만 `catalog.ts`에서 고칩니다.
   - `verification: 'official-checked'`로 올립니다.
   - 공식 기술명이 확인되면 `curatedKeyTech`에 추가합니다.
   - 분류가 달라졌으면 `sub`(세부 카테고리)를 고칩니다. `plate`/`levels`/`distances`는
     세부 카테고리 기본값을 쓰되, 공식 설명과 다르면 항목별로 덮어씁니다.
   - 확인되지 않은 수치는 여전히 넣지 않습니다. `specNote`로 미확인 사실을 남깁니다.
3. `SHOE_DATA_VERSION`을 올립니다 (`YYYY.MM.DD-vN` 형식).
4. 검증:

```bash
npm --prefix apps/mobile run check
node --import ./apps/mobile/node_modules/tsx/dist/loader.mjs scripts/refresh-shoe-data.mjs
```

5. PR로 올립니다. `main` 직접 push는 하지 않습니다.

## 5. 항목을 새로 추가할 때

`define({ ... })`에 최소한 다음을 넣으면 나머지는 세부 카테고리·브랜드 기준값으로 채워집니다.

- 필수: `id`, `brand`, `model`, `modelEn`, `sub`, `strengths`(2~4개), `watchouts`(1~2개), `pick`
- 선택 덮어쓰기: `plate`, `levels`, `distances`, `priceBand`, `purposeTags`,
  `useCase`, `fitNote`, `bestForRunner`, `notFor`, `keyTech`, `comparedTo`, `specNote`, `verification`

`comparedTo`를 비워 두면 같은 세부 카테고리 안에서 다른 브랜드 대안 2종이 자동으로 연결됩니다
(`curatedComparisons`에 대표 조합을 넣어 두면 그쪽이 우선합니다). 어느 경우든 참조 무결성은
단위 테스트와 갱신 스크립트가 함께 지킵니다.
