# RunningBom V6 Codex 2차 독립 감사 결과

## 판정

`FAIL`

자동 검증에서 발견한 런타임 결함은 수정했지만, `02_CODEX_SECOND_PASS.txt`가 요구한
메트로놈 고급 모드 전체와 실기기 오디오 증거가 아직 없으므로 합격으로 과장하지 않는다.
이 문서는 현재 보완 브랜치의 코드와 자동 검증 결과만 기록한다.

## 기준선

- 지침: `START_CODEX.md`, `02_CODEX_SECOND_PASS.txt` 전문 확인
- 기준 브랜치: `origin/main`
- 최초 감사 기준 SHA: `e08acf1d0c18fd5e605be78bdc41db4719d4b441`
- 최종 재배치 기준 SHA: `e4f0d438ee0f2faadcf1453c0b98ba6de352ddaf`
- 기준 앱 버전: `0.19.0`
- 찾은 최신 Claude 1차 작업: PR #71, `feat/v6-body-cursor`에서 시작했고 감사 중
  `main`의 `7955f2d`로 병합됨
- Claude HEAD: `9cac44558dd70100b5237830f1d9c76d3b5c0bda`
- Claude merge base: `c126b68`
- 보완 브랜치: `codex/runningbom-v6-second-pass-20260728`
- 시작 시 worktree: clean
- Play 단계: `CODE_ONLY`
- Play internal 변경: 없음
- Play closed 변경: 없음
- Play production 변경: 없음

## 독립 감사에서 설명과 달랐던 부분

1. 자세 커리큘럼 커서는 React 렌더 중 모듈 전역값으로 계산되고 네이티브 시작 전에
   소비됐다. 시작 실패나 사전 렌더만으로도 다음 내용으로 건너뛸 수 있었다.
2. Android 코치는 세션 전체에 오디오 포커스를 잡아 음악·팟캐스트를 장시간 방해할 수
   있었다.
3. 메트로놈 소리는 화면의 JavaScript 타이머와 진동에 의존했고, 화면 잠금·장시간 박자
   정본이 아니었다.
4. iOS 네이티브 브리지는 비어 있어 화면 잠금 코칭과 메트로놈을 제공하지 못했다.
5. 풀토크는 문장 길이 합계만으로 설명됐고 실제 겹침을 합친 시간축 점유율과 무음 구간을
   검사하지 않았다.
6. 오픈엔드는 6시간 분량 뒤 자동 완료될 수 있었고, 복원 화면은 네이티브 상태보다 오래된
   사용자 설정을 우선했다.
7. 긴 세션에서 가까운 구간에 같은 문장이 반복될 수 있었다.

## 직접 수정한 내용

- 커리큘럼 생성 결과를 `session + plannedCount`인 순수 계획으로 바꾸고, 네이티브 시작이
  성공한 뒤에만 커서를 전진시켰다.
- Android는 발화 직전에만 `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`을 요청하고,
  `onDone`, `onError`, `onStop`에서 반환하도록 바꿨다. 지연 포커스는 받지 않는다.
- Android 메트로놈을 foreground `mediaPlayback` 서비스와 `AudioTrack` blocking
  PCM clock으로 교체했다. 소수 프레임 경계를 누적 계산하고 PCM 블록을 재사용한다.
- iOS에 `AVSpeechSynthesizer`, 단조 시계, interruption·route change 처리,
  공유 오디오 세션과 `AVAudioEngine` 메트로놈을 구현했다.
- 풀토크에 실제 타임라인 점유율·무음·반복 감사를 추가하고, 기존 검증 문장으로 긴 공백을
  채우되 최근 4문장 안에서는 같은 문장을 다시 쓰지 않게 했다.
- 오픈엔드 계획 지평을 12시간으로 늘리고 네이티브·fallback 모두 사용자 종료 전에는
  자동 완료하지 않게 했다.
- 복원 시 네이티브 런타임의 `openEnded`를 정본으로 사용한다.

## 풀토크 시간 행렬

측정 기준은 겹치는 발화를 합친 실제 시간축이다. 발화 시간은 테스트용 결정론적 추정치이며
사람 청취 시간을 대신하지 않는다.

| 분 | 큐 | 점유율 | 중간 무음 | p95 무음 | 최대 무음 | 근접 동일문장 |
|---:|---:|---:|---:|---:|---:|---:|
| 3 | 37 | 78.7% | 1.10초 | 2.27초 | 2.54초 | 0 |
| 5 | 51 | 80.4% | 1.10초 | 3.36초 | 3.55초 | 0 |
| 10 | 97 | 84.6% | 1.10초 | 2.36초 | 3.91초 | 0 |
| 20 | 192 | 85.0% | 1.10초 | 3.18초 | 4.09초 | 0 |
| 30 | 291 | 84.8% | 0.99초 | 3.36초 | 4.09초 | 0 |
| 49 | 476 | 84.7% | 1.00초 | 3.36초 | 4.09초 | 0 |
| 50 | 498 | 85.3% | 0.99초 | 2.90초 | 4.09초 | 0 |
| 51 | 493 | 84.2% | 1.00초 | 3.36초 | 4.09초 | 0 |
| 60 | 591 | 83.9% | 1.00초 | 3.55초 | 4.09초 | 0 |
| 90 | 952 | 81.3% | 1.10초 | 3.55초 | 4.09초 | 0 |
| 119 | 1,290 | 79.6% | 1.10초 | 3.73초 | 4.09초 | 0 |
| 120 | 1,316 | 80.3% | 1.10초 | 3.55초 | 4.09초 | 0 |
| 121 | 1,318 | 80.0% | 1.10초 | 3.73초 | 4.09초 | 0 |
| 180 | 2,037 | 78.8% | 1.10초 | 3.55초 | 4.09초 | 0 |
| 360 | 4,220 | 77.5% | 1.10초 | 3.73초 | 4.09초 | 0 |
| 720 | 8,536 | 76.7% | 1.10초 | 3.73초 | 4.09초 | 0 |

오픈엔드 12시간은 8,505큐, 점유율 76.6%, 최대 무음 4.16초, 근접 동일문장 0건,
거짓 진행·종료 큐 0건이다.

장시간 세션에는 전체 문장 라이브러리 크기의 한계로 멀리 떨어진 동일 문장이 존재한다.
최근 4개 문장 내 반복은 금지했고 메모리·큐는 12시간 유한 배열로 제한했다.

## 메트로놈 자동 검증

- Android: `AudioTrack.MODE_STREAM`, `WRITE_BLOCKING`, foreground
  `mediaPlayback`, PCM cache, underrun count 저장
- iOS: 정확히 1분 길이 PCM을 `AVAudioEngine`과 `AVAudioPlayerNode`에서 반복
- BPM: 60, 120, 140, 160, 170, 180, 200
- 길이: 30분, 2시간, 6시간
- 자동 수학 검증: 각 조합의 경계 위상 오차 1프레임 미만
- 화면의 interval은 상태 표시 전용이며 소리를 생성하지 않음

다음 고급 모드는 현재 제품 화면·네이티브 계약에 아직 없다.

- 기준 대비 +3%, +5%, +7%, +10%
- 두 걸음에 한 번, 좌우 교대, 4박·8박 강조
- 인터벌 연동, ramp, fade, 진동 보조, 직접 패턴, 탭 입력
- Bluetooth offset

따라서 `metronome modes`는 `FAIL_OPEN`이며 전체 자동 합격을 선언하지 않는다.

## 자동 검증 증거

- `npm run check` in `apps/mobile`: 1,165 tests PASS, TypeScript PASS,
  config verification PASS, Expo public config PASS
- root `npm test`: 79 tests PASS
- root `npm run build`: PASS
- `npm run export:native`: Android·iOS export PASS
- Android `:app:compileReleaseKotlin`: PASS, 301 tasks
- iOS `swiftc -parse`: PASS
- `git diff --check`: PASS
- lockfile이 없어 `npm audit`는 실행되지 않음. 의존성 감사는 `NOT_RUN`으로 남긴다.

## 요구사항 추적

| 항목 | 상태 | 증거·설명 |
|---|---|---|
| arbitrary fixed duration | PASS | 3~720분 행렬 |
| open-ended extent | FAIL_FIXED | 12시간 계획과 자동완료 제거 |
| 12h memory bound | PASS | 유한 12시간 큐, 생성 약 0.2초 |
| full-talk occupancy | FAIL_FIXED | 76.6~85.3%, 최대 무음 4.16초 |
| false ending | FAIL_FIXED | 오픈엔드 progress·completion 0 |
| form curriculum cursor | FAIL_FIXED | 시작 성공 뒤 명시적 cursor 소비 |
| honorific/casual | PASS | 기존 회귀 테스트 유지 |
| seven personas | PASS | 기존 회귀 테스트 유지 |
| false sensing guard | PASS | 기존 정적 문구 검사 유지 |
| Android audio focus | FAIL_FIXED | 발화 단위 transient may-duck |
| iOS audio session | POLICY_REVIEW_REQUIRED | 무음 background loop 정책 검토 필요 |
| music/podcast/call/Bluetooth | DEVICE_REQUIRED | 실제 기기·앱 조합 미실행 |
| native audio clock | FAIL_FIXED | Android AudioTrack, iOS AVAudioEngine |
| metronome fixed BPM | PASS | 60~200 BPM 장시간 수학·계약 검사 |
| metronome modes | FAIL_OPEN | 고급 모드 미구현 |
| system premium voice | HUMAN_LISTENING_REQUIRED | 사람 청취 미실행 |
| human recording pipeline | BLOCKED_CEO_AUDIO_RECORDING | 권리 확인된 녹음 자산 없음 |
| CI/tests | PASS | 위 자동 검사 통과 |
| device evidence | DEVICE_REQUIRED | Samsung·Pixel·iPhone 실기기 미실행 |

## 실기기·사람·정책 게이트

- `DEVICE_REQUIRED`: Samsung·Pixel·iPhone, 화면 잠금, 절전, 전화, 알람, 지도,
  Bluetooth·유선 이어폰, 음악·팟캐스트 조합
- `HUMAN_LISTENING_REQUIRED`: 한국어 TTS 속도·억양·반복 피로도·발화 겹침 청취
- `BLOCKED_CEO_AUDIO_RECORDING`: 실제 인간 음성은 녹음·권리 manifest 없이 배포 불가
- `POLICY_REVIEW_REQUIRED`: iOS 무음 PCM background 유지 방식과 Play foreground
  service 설명을 스토어 제출 전 검토

## 롤백

보완 브랜치 전체를 되돌릴 때는 보완 PR의 merge commit을 확인한 뒤 다음을 실행한다.

```bash
git revert <보완-PR-merge-SHA>
```

Claude PR #71만 별도로 되돌릴 때는 병합된 main commit `7955f2d`를 기준으로 의존
커밋과 함께 검토한다. 보완 브랜치 rebase 중 동일 cherry-pick은 자동으로 제외됐다.

## Play 영향

PLAY INTERNAL CHANGED: NO

PLAY CLOSED CHANGED: NO

PLAY PRODUCTION CHANGED: NO

EXISTING CLOSED TESTERS IMPACTED: NO
