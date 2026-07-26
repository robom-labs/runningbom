# 러닝봄 Preview APK 안내

이 문서는 **개발자가 아닌 분**을 위한 안내입니다. 러닝봄의 최신 개발본(Preview)을 안드로이드 폰에
직접 설치해서 미리 써 보는 방법을 설명합니다.

---

## 1. 한 줄 요약

- 러닝봄 **Preview**는 정식 러닝봄 앱과 **완전히 별개로 설치되는 미리보기 앱**입니다.
- 정식 앱(Play 스토어 비공개 테스트)은 그대로 두고 두 개를 함께 써도 됩니다.
- Preview는 GitHub Actions가 자동으로 만들어 GitHub Release에 올려 둡니다.

---

## 2. 어디서 받나요

**항상 최신본 주소 (이 주소만 기억하시면 됩니다)**

<https://github.com/robom-labs/runningbom/releases/tag/preview-latest>

파일 직접 내려받기:

<https://github.com/robom-labs/runningbom/releases/download/preview-latest/runningbom-preview.apk>

지난 버전들은 `preview-v<버전>-<빌드번호>` 이름의 릴리스에 그대로 남아 있습니다.
(예: `preview-v0.19.0-9`)

---

## 3. 설치 방법

1. **안드로이드 폰의 크롬 브라우저**로 위 주소를 엽니다.
2. `runningbom-preview.apk` 파일을 눌러 내려받습니다.
3. 다운로드가 끝나면 파일을 누릅니다.
4. 처음 설치할 때는 "알 수 없는 출처의 앱 설치"를 허용해 달라는 안내가 뜹니다.
   → 안내를 따라 **크롬(또는 파일 앱)에 설치 권한을 허용**해 주세요.
   (설정 → 앱 → 특별한 앱 접근 → 알 수 없는 앱 설치)
5. "설치"를 누릅니다.
6. 홈 화면에 **"러닝봄 Preview"** 라는 이름의 앱이 생깁니다.

> 정식 앱은 그냥 **"러닝봄"**, 미리보기 앱은 **"러닝봄 Preview"** 입니다. 이름으로 구분하세요.

---

## 4. 업데이트 방법

**Preview 앱을 지우지 마세요.** 새 APK를 받아 그대로 설치하면 기존 앱 위에 덮어쓰기 됩니다.
기록과 설정도 그대로 유지됩니다.

1. 위의 `preview-latest` 주소에서 새 APK를 받습니다.
2. 그냥 설치합니다. "앱을 업데이트하시겠습니까?"라고 물으면 확인을 누릅니다.

앱 안에도 안내가 있습니다. 새 버전이 나오면 앱 화면 위쪽에
**"새 Preview 버전이 있어요 → 다운로드"** 배너가 하루에 한 번 정도 나타납니다.

> 덮어쓰기 설치가 되는 이유는 두 가지입니다. ① 매 빌드마다 **빌드번호(versionCode)** 를 올리고,
> ② 항상 **같은 서명 키**(EAS에 저장된 Preview 키)로 서명하기 때문입니다.
> 서명이 달라지면 "앱이 설치되지 않음" 오류가 나므로 서명 키는 절대 바꾸지 않습니다.

---

## 5. 새 빌드 만드는 법 (담당자용)

1. GitHub 저장소 → 상단 **Actions** 탭
2. 왼쪽 목록에서 **Preview APK** 선택
3. 오른쪽 **Run workflow** 버튼 클릭
4. 입력값 (둘 다 비워 두어도 됩니다)
   - `version_code`: 빌드번호를 직접 지정하고 싶을 때만 입력 (비우면 기본값 사용)
   - `publish_release`: 릴리스를 올릴지 여부 (기본 켜짐)
5. **Run workflow** → 30~60분 정도 기다립니다.
6. 끝나면 요약(Summary)에 패키지명, 버전, 크기, SHA-256이 표시되고
   `preview-latest` 릴리스의 APK가 새것으로 교체됩니다.

`main` 브랜치에 `apps/mobile/**` 변경이 들어가도 같은 빌드가 자동으로 한 번 돕니다.

### 워크플로가 하는 일 (순서)

| 순서 | 단계 | 실패하면 |
| --- | --- | --- |
| 1 | 의존성 설치 (`npm ci`) | 중단 |
| 2 | 테스트 (`npm test`) | 중단 |
| 3 | 타입·설정 검증 (`npm run check`) | 중단 |
| 4 | Preview 설정의 패키지명이 `kr.robom.runningbom.preview`인지 확인 | 중단 |
| 5 | `eas build --local`로 러너에서 직접 APK 빌드 | 중단 |
| 6 | 완성된 APK를 열어 **실제 패키지명 재확인** (정식 패키지면 실패) | 중단 |
| 7 | SHA-256·크기 계산 후 요약에 기록 | — |
| 8 | `preview-v<버전>-<빌드번호>` 릴리스 게시 | — |
| 9 | `preview-latest` 릴리스 갱신 (자산 교체) | — |
| 10 | 인앱 배너용 매니페스트가 최신인지 점검 | 경고만 |

품질 게이트(2·3번)가 실패하면 **APK를 아예 만들지 않습니다.** 조용히 성공하는 경우는 없습니다.

---

## 6. 빌드번호(versionCode) 올리는 법

새 APK를 배포할 때마다 빌드번호가 올라가야 기존 설치본이 업데이트됩니다.

**방법 A — 기본값 수정 (권장)**

`apps/mobile/app.config.js` 맨 위의 값을 1 올립니다.

```js
const PREVIEW_DEFAULT_VERSION_CODE = 9; // → 10, 11, ...
```

**방법 B — 한 번만 임시로 올리기**

Actions에서 워크플로를 돌릴 때 `version_code` 입력칸에 숫자를 넣습니다.
이 값은 기본값보다 **작으면 무시**되며(안전장치), 저장소에는 남지 않습니다.

> 정식 앱(`kr.robom.runningbom`)의 versionCode는 `apps/mobile/app.json`에 따로 있고,
> Preview 빌드는 이 값을 **전혀 건드리지 않습니다.**

### 앱 안 업데이트 배너 갱신

빌드번호를 올렸다면 `outputs/pushrun-site/preview/version.json`도 같이 올려 주세요.
이 파일이 GitHub Pages로 서빙되어 앱이 "새 버전 있음"을 판단하는 기준이 됩니다.

```json
{
  "latestVersion": "0.19.0",
  "versionCode": 9,
  "apkUrl": "https://github.com/robom-labs/runningbom/releases/download/preview-latest/runningbom-preview.apk"
}
```

빠뜨리면 워크플로 요약에 경고가 뜹니다(빌드 자체는 성공합니다). APK는 정상이고,
앱 안 배너만 뜨지 않는 상태가 됩니다.

---

## 7. 정식 앱·Play 스토어와의 관계

| 항목 | 정식 러닝봄 | 러닝봄 Preview |
| --- | --- | --- |
| 앱 이름 | 러닝봄 | 러닝봄 Preview |
| 패키지 | `kr.robom.runningbom` | `kr.robom.runningbom.preview` |
| 배포 경로 | Play 스토어 비공개 테스트 | GitHub Release APK |
| 데이터 | 서로 완전히 분리 | 서로 완전히 분리 |
| 소셜 로그인·외부 공유 | 정책에 따름 | 기본 꺼짐 |

- **이 워크플로는 Play Console에 아무것도 올리지 않습니다.** `eas submit`도 실행하지 않습니다.
- Play 비공개 테스트 진행 상황과 Preview APK 배포는 서로 아무 영향이 없습니다.
- Preview를 설치해도 정식 앱이 지워지거나 바뀌지 않습니다.

---

## 8. 자주 생기는 문제

| 증상 | 원인 / 해결 |
| --- | --- |
| "앱이 설치되지 않았습니다" | 서명이 다른 APK입니다. 예전 Preview를 지우고 새로 설치하세요(기록은 초기화됩니다). |
| "이 파일은 유해할 수 있습니다" | 스토어를 거치지 않은 APK라 나오는 일반 경고입니다. "무시하고 설치"를 누르세요. |
| 설치 버튼이 안 눌림 | "알 수 없는 앱 설치" 권한이 아직 없습니다. 3번 항목 4단계를 다시 확인하세요. |
| 앱 안 배너가 안 뜸 | `version.json`의 `versionCode`가 아직 안 올라갔거나, 24시간 확인 주기 안입니다. |
| Actions 빌드 실패 | 로그의 `::error::` 줄에 원인이 있습니다. `EXPO_TOKEN` 시크릿 만료가 가장 흔합니다. |

---

## 9. 참고 (개발자용)

- 워크플로: `.github/workflows/preview-apk.yml`
- 빌드 방식: `eas build --platform android --profile preview --local`
  → 러너에서 직접 빌드하므로 **EAS 원격 빌드 크레딧을 소모하지 않습니다.**
- 서명: `EXPO_TOKEN`으로 EAS에 저장된 기존 Preview 키를 그대로 사용합니다.
- 인앱 업데이트 코드: `apps/mobile/services/updates/` (자세한 내용은 그 폴더의 `README.md`)
- 앱 버전(versionName) `0.19.0`은 저장소 전체(`package.json`, family 정본 `app-meta.json`,
  `family.lock.json` 해시)와 묶여 있어 Preview 단독으로 올릴 수 없습니다.
  Preview 업데이트 판정은 **versionCode 기준**이므로 versionName은 그대로 두어도 문제없습니다.
  versionName을 올리려면 본사(robom) 패밀리 정본 재생성이 함께 필요합니다.
