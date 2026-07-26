# services/updates — Preview 업데이트 안내

러닝봄 **Preview** 설치본이 최신 APK를 놓치지 않도록, GitHub Pages에 있는 정적 매니페스트를 조회해
새 버전이 있으면 배너를 띄웁니다. 정식 앱(`kr.robom.runningbom`)에서는 항상 비활성입니다.

## 구성

| 파일 | 역할 |
| --- | --- |
| `checkForUpdate.ts` | 매니페스트 조회·검증·24시간 빈도 제한·닫음 기록 |
| `UpdateBanner.tsx` | 새 버전이 있을 때만 렌더링되는 자급자족 배너 |
| `index.ts` | 공개 export |

## 데이터 출처

- 매니페스트: `https://robom-labs.github.io/runningbom/preview/version.json`
  (저장소 파일 `outputs/pushrun-site/preview/version.json`)
- APK: `https://github.com/robom-labs/runningbom/releases/download/preview-latest/runningbom-preview.apk`

## 화면 연결 방법 (통합 담당자용)

이 폴더는 다른 화면 파일을 수정하지 않습니다. 통합할 때 원하는 화면 상단에 한 줄만 넣으면 됩니다.

```tsx
import { UpdateBanner } from '../../services/updates';

// 화면 JSX 안 아무 곳
<UpdateBanner />
```

설정 화면에서 "지금 확인" 버튼을 만들고 싶다면:

```tsx
import { checkForUpdate } from '../../services/updates';

const result = await checkForUpdate({ force: true });
// result.status: 'update-available' | 'up-to-date' | 'skipped' | 'not-preview' | 'unavailable'
```

## 안전 규칙

- 오프라인·타임아웃(6초)·JSON 손상 시 예외를 던지지 않고 `unavailable`을 반환합니다. 배너는 그냥 뜨지 않습니다.
- 확인 빈도는 24시간에 1회입니다(`force: true`로 우회 가능).
- `apkUrl`은 `https://github.com/robom-labs/runningbom/`로 시작할 때만 신뢰합니다. 임의 주소로 유도할 수 없습니다.
- 업데이트 판정 기준은 **versionCode**입니다. versionName(0.19.0)이 그대로여도 versionCode가 올라가면 새 버전으로 인식합니다.
- 사용자가 "나중에"를 누르면 해당 versionCode 배너는 다시 뜨지 않습니다.
