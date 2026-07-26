# 러닝봄 정적 데이터 보고서

## 생성된 데이터셋

| 파일 | 콘텐츠 버전 | 레코드 수 | 바이트 |
|---|---|---:|---:|
| `data/races.json` | `2026.07.26-race-data-14` | 183 | 137473 |
| `data/shoes.json` | `2026.07.26-v1` | 8 | 7183 |
| `data/upcoming-shoes.json` | `2026.07.26-v1` | 0 | 238 |
| `data/coaching.json` | `2026.07-v1` | 60 | 117189 |

`data/manifest.json`의 manifest 콘텐츠 버전은 `static-b75379acacf257fd72c0`이고 최소 앱 버전은 `0.19.0`이다. manifest에는 네 파일의 SHA-256, 크기, 레코드 수가 있다.

## 대회 데이터 흐름

현재 데이터 흐름은 다음과 같다.

`outputs/pushrun-site/races.json`
→ `scripts/sync-mobile-races.mjs`
→ `apps/mobile/src/data/races.json`
→ `scripts/static-data-generate.mjs`
→ `data/races.json`과 `data/manifest.json`

모바일 런타임은 기본적으로 다음 raw GitHub 주소에서 최신 모바일 번들을 읽는다.

`https://raw.githubusercontent.com/robom-labs/runningbom/main/apps/mobile/src/data/races.json`

환경변수 `EXPO_PUBLIC_RACE_DATA_URL`로 주소를 바꿀 수 있다.

## 런타임 보호

- 원격 응답의 revision과 races 배열을 확인한다.
- 개별 대회 최소 스키마를 확인한다.
- 중복 ID, 취소, 연기, 매진, 마감, 종료일 경과 항목을 제외한다.
- 유효 대회가 0건이면 원격 응답을 거부한다.
- revision이 같으면 React 상태를 교체하지 않는다.
- 최초 fetch는 `AbortController`로 unmount 시 취소한다.
- 원격 fetch 실패 시 설치된 번들 데이터를 유지한다.

## 자동 갱신

`.github/workflows/refresh-race-data.yml`은 6시간마다 17분에 실행되도록 설정돼 있다.

1. 공개 일정 수집과 정규화
2. 모바일 번들 동기화
3. 정적·모바일 계약 테스트
4. 리포트 artifact 업로드
5. 실제 데이터 변경이 있을 때만 main 커밋과 push

실제 GitHub Actions 최근 실행 성공 여부는 이 문서 작업에서 확인하지 않았으므로 `NOT_RUN`이다.

## 러닝화와 코칭

`data/shoes.json`과 `data/coaching.json`은 코드 정본에서 생성된다. manifest와 checksum 생성·검증 스크립트는 존재한다.

모바일 정적 데이터 저장소는 HTTPS 원격 manifest와 데이터 파일을 내려받고 schema·minimumAppVersion·SHA-256·크기를 모두 확인한 뒤 versioned 경로에 저장한다. 모든 파일 검증이 끝난 뒤에만 active manifest를 atomic 교체한다. 실패 시 기존 LKG를 유지하고, LKG가 없으면 설치 번들을 사용한다. 현재 production 기본값은 원격 base URL이 비어 있어 설치 번들 또는 LKG만 사용한다.

## 검증 결과

| 검증 | 상태 |
|---|---|
| 모바일 대회 revision과 레코드 수 확인 | PASS_CODE |
| manifest의 네 파일 checksum 존재 | PASS_CODE |
| 모바일 테스트 34건 | PASS_TEST |
| 모바일 typecheck | PASS_TEST |
| 모바일 config verify | PASS_TEST |
| 루트 전체 `npm test` 78건 | PASS_TEST |

루트 전체 `npm test`는 패밀리 검증, 정적 데이터 manifest, 대회 데이터, 모바일 런타임 계약, workflow action SHA 고정과 Supabase 보안 계약의 정적 검사를 포함하며 78건이 모두 통과했다.
