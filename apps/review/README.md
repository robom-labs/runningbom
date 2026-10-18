# 러닝봄 · 통합 화면

밝은 사진 중심 디자인으로 오늘 / 대회 / 장비 / 소통 / 내 일정을 연결한 실제 저장소의 웹 UI다. 최신 인계와 출시 관문은 루트 `HANDOFF.md`, 화면 검수는 `design-qa.md`, 전체 보고서는 `../../outputs/release-review/index.html`을 읽는다. 공개 배포·Play 업로드는 아직 하지 않았다.

## 실행

루트에서 Node 22 이상으로 `npm ci`, `npm --prefix apps/mobile ci`, `npm --prefix apps/review ci` 후 `npm run review:dev`를 실행한다. 공개 Supabase 프로젝트 설정은 루트 실행기가 전달하고, 비밀키는 사용하지 않는다.

- `http://127.0.0.1:4173/`: 보존된 iPhone/Pixel 기기 미리보기.
- `http://127.0.0.1:4173/?display=web`: 휴대폰·태블릿·PC 반응형 화면.
- 프로덕션 웹은 반응형이 기본이다. `?display=phone`으로 기기 프레임을 확인할 수 있다.
- `npm run review:test`, `npm run review:build`, `npm --prefix apps/review run check:runtime`으로 검사한다.

## 현재 데이터와 기능

- 200 러닝화 모델, 15 브랜드. 원본 사진·SKU·색상·근거·해시를 보존한다. 출시 예정 2개. 미확인 사실은 행/섹션을 생략한다.
- 대회 원본 114건 중 검토 필요/연도 충돌 및 확인된 중복을 제외해 2026-10-18 공개 화면은 87건이다. 검증된 미디어 93개를 원본 캐시로 사용하며, 없는 이미지는 만들지 않는다.
- 개최/접수 시작/마감, 지역·거리, 카드·달력, 관심 저장·알림 조건·ICS 내보내기. 실제 발송과 브라우저 조건 저장은 구분한다.
- 장비는 큰 검색·문답 진입을 없애고 한 줄 브랜드/가격/정렬, 종류 레일, 훈련 용도, 원본 사진 목록과 비교를 먼저 보여준다. 가격 미확인/해외 통화는 국내 가격 범위에 끼워 넣지 않는다.
- 전용 Supabase의 실제 게시글/댓글/응원/채팅/프로필/신고/차단을 사용한다. 가짜 피드로 대체하지 않는다. 미설정 OAuth는 비활성이다. 사용자 사진 업로드·팔로우·DM 전체는 구현됐다고 주장하지 않는다.
- 내 일정은 실제 닉네임/@아이디와 비공개 계정 관리, 관심 대회/장비/알림을 모은다. 비로그인 상태에 가짜 계정을 넣지 않는다.

## 재사용과 구조

실제 사용: 기존 기기 런타임, React, FullCalendar Standard, Luxon, Radix, Phosphor, ICS, SurveyJS Form Library, Supabase SDK. 수집은 루트의 Crawlee/Cheerio/Zod로 연결했다. Bluesky/Pixelfed/FitTrackee는 정보 구조 참고다. 과거 NodeBB 어댑터는 남아 있지만 현재 소통의 실제 엔진은 Supabase다. n8n·RSSHub·Docling 등 조사 후보가 전부 설치·가동 중인 것은 아니다.

`src/Prototype.tsx`, `src/prototype.css`, `src/features/`, `src/integrations/`는 앱 소유 코드다. `AGENTS.md`의 보호 런타임 28개 파일과 원본 해시를 유지한다. 사진 원본을 리사이즈/재색칠해 다른 제품처럼 만들지 않는다. 비어 있는 상품/핏 정보나 인기 순위를 추정하지 않는다. 건강 관련 문답은 메모리에만 두며 질환별 치료 효과를 약속하지 않는다.

웹 UI는 Expo 네이티브와 별도 구현이다. 웹 빌드·브라우저 검수 통과는 AAB 서명·실기기 설치·Play 검수 통과를 뜻하지 않는다. 실제 간편 로그인, 서버 알림, 계정 저장 동기화, 새 GitHub 정기 수집 활성화, 결제·광고 계약과 네이티브 화면 대조는 루트 인계 체크리스트에 기록했다.
