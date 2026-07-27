# RunningBom Mobile

러닝봄의 Android·iOS 독립 네이티브 앱입니다. Expo SDK 57, React Native 0.86, React 19.2.3을 사용하며 웹 화면을 감싸지 않습니다.

## 제품 한 문장

처음 달리는 사람도 **오늘 무엇을 할지 정하고 → 음성 안내를 들으며 실행하고 → 기록과 성취를 남기고 → 국내 목표 대회까지 준비**할 수 있게 돕는 한국어 러닝 앱입니다.

## 현재 핵심 범위

- 기록·목표·계획·목표 대회를 묶어 오늘 할 일을 보여 주는 홈
- 이지런·인터벌·템포런·롱런·회복걷기 등 시간 기반 음성 코치
- 걷기와 달리기를 섞어 30분 연속 달리기까지 이어지는 9주 시작 프로그램
- 국내 대회 탐색, 관심 대회, 목표 대회와 정확한 접수 시작 로컬 알림
- 목표 대회 날짜와 최근 기록을 바탕으로 한 주차별 준비 계획
- 활동 기록, 주간 목표, 연속 기록, 최고기록, 시각 배지와 진행도
- 러닝화 갈래·거리·실력·가격·브랜드별 탐색, 추천, 비교, 관심·현재 신발 저장
- 러닝 궁금증과 사용자가 올리는 공간을 분리한 정보·공유 구조
- 로그인 없이 시작하는 로컬 우선 저장과 선택적 Supabase 계정·커뮤니티 연결
- `runningbom://race/{raceId}` 딥링크와 알림 탭 시 해당 대회 열기

## Production과 Preview의 차이

Google Play 심사 중인 정식 빌드에 새 권한을 몰래 추가하지 않습니다.

| 구분 | 패키지 | 위치 권한 | 러닝 기록 | 원격 업데이트 |
|---|---|---:|---|---:|
| Production | `kr.robom.runningbom` | 없음 | 시간 기반 음성 코치·로컬 활동 | 비활성 |
| Preview | `kr.robom.runningbom.preview` | 앱 사용 중 | GPS 거리·페이스·자동 멈춤·1km 구간·경로 | 호환 런타임에서 활성 |

백그라운드 위치 권한은 두 빌드 모두 사용하지 않습니다. 정식 GPS 기록은 Play 심사와 정책 고지를 다시 준비한 다음 별도 버전에서만 활성화합니다.

## 저장과 진실성 원칙

- 활동과 설정은 기본적으로 기기에 저장합니다.
- 저장 실패 시 성공한 것처럼 표시하지 않고 현재 실행에서만 유지될 수 있음을 알립니다.
- 정확한 접수 시각이 확인되지 않은 대회는 임의 시각 알림을 만들지 않습니다.
- 외부 데이터 갱신이 실패하면 마지막 검증 데이터를 유지합니다.
- 서버가 연결되지 않았을 때 가짜 사용자·가짜 글·가짜 참가자 수를 만들지 않습니다.
- 기존 저장 키와 내부 ID는 호환성을 위해 임의로 바꾸지 않습니다.

## 로컬 실행

```bash
cd apps/mobile
npm ci
cp .env.example .env
npm run start:go
```

custom scheme, Preview 위치 기록, 네이티브 음성 서비스와 실제 Expo 설정은 development/preview build에서 검증합니다.

```bash
npm start
```

`.env`의 `EXPO_PUBLIC_*` 값은 앱 번들에 공개됩니다. 비밀키, 서비스 역할 키, 서명 인증서, 스토어 자격 증명을 넣지 않습니다.

## 검증

```bash
npm run check
npx expo-doctor
npm run export:native
```

`npm run check`는 TypeScript, 단위·회귀 테스트, Expo 설정, 출시 계약을 검사합니다. `export:native`는 Android와 iOS Hermes 번들을 각각 생성합니다. 생성된 `dist`는 Git에서 제외됩니다.

## 딥링크 예시

```bash
npx uri-scheme open "runningbom://race/wyd-life-run-2026" --android
npx uri-scheme open "runningbom://race/wyd-life-run-2026" --ios
```

공식 대회 페이지와 러닝화 구매 경로는 운영체제 기본 브라우저로 엽니다. 공개 링크는 HTTPS와 검증된 출처 계약을 통과해야 합니다.

## EAS 빌드 프로필

- `development`: 개발·디버깅용 내부 빌드
- `preview`: 정식 앱과 패키지를 분리한 실기기 고급 기능 검증 APK
- `production`: 스토어 제출용 AAB·IPA

```bash
npx eas-cli build --profile development --platform android
npx eas-cli build --profile preview --platform all
npx eas-cli build --profile production --platform all
```

## 스토어 제출 전 절차

1. Google Play Console과 Apple Developer에서 `kr.robom.runningbom` 식별자·서명 소유권을 확인합니다.
2. 앱 버전, Android `versionCode`, iOS `buildNumber`를 출시 값으로 맞춥니다.
3. 개인정보·지원 URL과 실제 Production 권한을 다시 확인합니다.
4. `npm run check`, `npx expo-doctor`, `npm run export:native`, Production 의존성 감사를 통과합니다.
5. 실제 기기에서 첫 실행, 코치 시작·일시정지·종료, 기록 저장, 알림, 음악·이어폰 공존을 확인합니다.
6. 스토어 설명과 스크린샷이 Preview 기능을 Production 기능처럼 과장하지 않는지 사람이 검토합니다.
7. 승인된 서명 빌드만 제출합니다.

서명키와 스토어 자격 증명은 EAS 또는 각 스토어의 보안 저장소에서 관리하고 저장소나 `.env`에 넣지 않습니다.
