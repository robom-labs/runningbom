# RunningBom Mobile

러닝봄의 Android·iOS 독립 네이티브 앱입니다. Expo SDK 57, React Native 0.86, React 19.2.3을 사용하며 웹 화면을 감싸지 않습니다.

## 제품 한 문장

**처음 달리는 사람도 오늘 할 운동을 바로 고르고, 한국어 음성 코칭과 함께 끝낸 뒤 기록·목표 대회·러닝화를 한곳에서 이어 관리하는 앱.**

## 현재 들어 있는 핵심 흐름

1. 첫 실행에서 주간 목표와 코치 음성을 고릅니다. 로그인은 핵심 사용 전에 강제하지 않습니다.
2. 홈에서 오늘의 추천 운동, 주간 목표, 연속 기록과 다음 행동을 봅니다.
3. 시간 기반 코치 또는 9주 달리기 시작 프로그램을 실행합니다.
4. 완료 기록은 홈·통계·주간 목표·연속 기록·배지에 공통으로 반영됩니다.
5. 국내 대회를 찾아 관심·알림·목표 대회로 저장하고 준비 계획으로 이어갑니다.
6. 러닝화를 목적·거리·실력·가격대별로 찾고 관심 신발과 현재 신발을 관리합니다.
7. 실제 내 기록만 공유 카드로 만들고, 존재하지 않는 사용자·게시물·성과는 만들지 않습니다.

## Production과 Preview의 차이

Google Play 비공개 테스트 중인 Production 앱에는 새 위치 권한을 추가하지 않습니다.

| 빌드 | 목적 | Android 위치 권한 | 거리·페이스·경로 |
|---|---|---:|---:|
| Production | 현재 스토어 심사·배포 | 없음 | 시간 기반 코칭과 로컬 기록 |
| Preview | 내부 실기기 검증 | 앱 사용 중에만 | GPS 거리·페이스·자동 멈춤·1km 구간·경로 |

Preview에서 검증된 기능을 Production으로 옮길 때는 Play 권한 고지, 개인정보 처리방침, 실기기 배터리·정확도 테스트를 다시 통과해야 합니다.

## 데이터와 개인정보

- 기본 기록·관심항목·설정은 기기에 저장합니다.
- 로그인 없이 핵심 기능을 사용할 수 있습니다.
- `EXPO_PUBLIC_*` 값은 앱 번들에 공개되므로 비밀키를 넣지 않습니다.
- API 키·OAuth 비밀값·서명 인증서·스토어 자격 증명은 EAS·Supabase·스토어의 비밀 저장소에만 둡니다.
- 대회 원격 피드는 로봄이 관리하는 HTTPS 경로만 허용하고, 공식 링크의 사설망·자격정보·도메인 변조를 거부합니다.
- 데이터 수집이나 동기화가 실패하면 마지막 검증 데이터를 유지합니다.

## 식별자와 권한

- Android package: `kr.robom.runningbom`
- iOS bundle identifier: `kr.robom.runningbom`
- custom scheme: `runningbom`
- Production Android 선언 권한: `POST_NOTIFICATIONS` 한 개
- 카메라·마이크·overlay·외부 저장소 권한은 명시적으로 차단
- 실제 서명 검증 전에는 Android App Link `autoVerify`와 iOS Universal Link를 활성화하지 않음

## 로컬 실행

SDK 57은 Node.js 22.13 이상이 필요합니다.

```bash
cd apps/mobile
npm ci
cp .env.example .env
npm run start:go
```

네이티브 설정과 custom scheme은 development 또는 preview 빌드에서 검증합니다.

```bash
npm start
```

## 검증

```bash
npm test
npm run typecheck
npm run verify
npm run config
npm run check
npx expo-doctor
npm run export:native
```

`npm run check`는 순수 규칙 테스트, TypeScript, 앱·권한·EAS·대회 데이터 계약, Expo 공개 config를 확인합니다. `export:native`는 Android와 iOS Hermes 번들을 각각 생성합니다. 생성된 `dist`는 Git에서 제외됩니다.

## EAS 빌드 프로필

- `development`: 로컬 개발 검증. 불필요한 overlay 권한을 넣는 development client를 기본으로 사용하지 않습니다.
- `preview`: 개발 도구 없는 내부 APK·iOS 검증 빌드. Production OAuth·소셜 쓰기를 기본 차단합니다.
- `production`: Google Play용 AAB와 App Store용 빌드.

```bash
npx eas-cli login
npx eas-cli build --profile preview --platform all
npx eas-cli build --profile production --platform all
```

## 스토어 제출 전 필수 절차

1. `kr.robom.runningbom` 식별자와 Play App Signing 소유권을 확인합니다.
2. 릴리스가 확정된 뒤에만 앱 버전, Android `versionCode`, iOS `buildNumber`를 올립니다.
3. 권한 거부, 알림, 저장 실패, 오프라인, 앱 재시작, 백버튼, 작은 화면과 큰 글씨를 실기기에서 확인합니다.
4. Production과 Preview의 실제 기능 차이가 스토어 설명·스크린샷·개인정보 고지와 일치하는지 확인합니다.
5. CI, 의존성 감사, Android·iOS export와 비공개 테스트 회귀를 통과합니다.
6. 승인된 서명 빌드만 사람이 Play Console 또는 App Store Connect에 제출합니다.

서명키와 스토어 자격 증명은 저장소나 `.env`에 넣지 않습니다. 이 저장소의 코드 변경만으로 실제 스토어 제출·승인·서명 완료를 주장하지 않습니다.
