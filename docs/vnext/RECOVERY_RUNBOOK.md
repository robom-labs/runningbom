# 러닝봄 vNext 복구 절차

## 현재 복구 기준

- 기준 main SHA는 `aa8fee4bac96cda5377c761b7e96446eb7922257`이다.
- 현재 작업 브랜치는 `r01/runningbom-vnext-first-pass`다.
- production-candidate AAB와 Preview APK의 source SHA는 `6dd45f26de428bb8115fc55d7b719e6b279635f6`다.
- 현재 릴리스 단계는 `CODE_ONLY`다.
- Play 내부·비공개·프로덕션 허용 플래그는 모두 `false`다.

구현은 아래 원자적 커밋으로 분리했다. 커밋되지 않은 변경을 임의로 삭제하거나 `git reset --hard`로 되돌리면 안 된다.

## 복구 시 보존해야 하는 식별자

- production Android package는 `kr.robom.runningbom`이다.
- Preview Android package는 `kr.robom.runningbom.preview`다.
- production scheme은 `runningbom`이다.
- Preview scheme은 `runningbom-preview`다.
- 로컬 SQLite 파일은 `runningbom-vnext.db`다.
- 설정 키는 `runningbom:vnext:preferences:v1`이다.
- 기존 대회 ID와 예약 알림 식별자를 변경하면 안 된다.
- Play에 사용된 versionCode는 재사용하면 안 된다.

## 코드 단계 복구

### 커밋 전

1. `git status`와 `git diff`로 작업자별 변경을 구분한다.
2. 사용자나 다른 작업자의 변경을 삭제하지 않는다.
3. 문제 파일만 수술식으로 수정한다.
4. 기준 구현을 비교할 때 `aa8fee4...`를 읽기 전용 기준으로 사용한다.

커밋되지 않은 전체 작업을 폐기하는 명령은 이 runbook에 두지 않는다.

### 커밋 후

문제가 있는 커밋만 다음 형식으로 되돌린다.

```bash
git revert --no-edit <문제가 있는 커밋 SHA>
```

여러 커밋이 의존하면 최신 커밋부터 하나씩 되돌리고 각 단계에서 테스트한다. vNext 구현 전체를 되돌릴 때는 최신 순서로 다음 명령을 실행한다.

```bash
git revert --no-edit 6dd45f26de428bb8115fc55d7b719e6b279635f6
git revert --no-edit ab4329f34a7b68e2e75146eae78dd0b18db84887
git revert --no-edit f735589dd1f4ed9287167f8f62c81935107ec235
git revert --no-edit b0d8e88893172910caa57f824e0621b3bb35c1f4
git revert --no-edit f234df3a888b217991e9c8ce2542c9aa7a1ee291
git revert --no-edit c8307d7bb9eb28b3ffa8700350a752fdfdc028b8
git revert --no-edit 7e2eff2f654708a83a5d2a03c0dfce4729dc7be8
git revert --no-edit 75101710b980bd402f8fa601cb1fc05b5a9cea44
```

마지막 문서 정리 커밋은 앱 실행 코드와 artifact를 바꾸지 않는다. 필요하면 main 반영 결과에 기록된 해당 문서 커밋만 별도로 `git revert --no-edit <문서 커밋 SHA>`로 되돌린다.

## 로컬 데이터 복구

- 앱 업데이트 검증에서는 기존 설치 위에 업데이트해 SQLite와 AsyncStorage가 유지되는지 확인한다.
- 스키마 변경은 앞으로만 적용되는 migration으로 처리한다.
- 데이터 삭제 버튼은 활동·일일 진행·배지 진행·동기화 큐를 지우므로 사용자의 명시 확인 없이 호출하지 않는다.
- 다른 계정의 서버 기록과 로컬 기록을 자동 병합하지 않는다.

## 코칭 장애 복구

1. 네이티브 코치 상태와 foreground service 로그를 확인한다.
2. 네이티브 시작에 실패하면 화면 텍스트와 기기 TTS fallback으로 앱을 유지한다.
3. 전화나 이어폰 해제 뒤 일반 cue를 몰아서 재생하지 않는다.
4. force-stop은 완료로 기록하지 않는다.
5. 제조사별 실기기 검증 전에는 장시간 백그라운드 재생을 PASS로 보고하지 않는다.

## 소셜 서버 장애 복구

- Supabase가 없으면 `CORE_ONLY`로 유지한다.
- 쓰기 오류가 증가하면 `READ_ONLY_COMMUNITY`로 제한한다.
- 코어 대회·코칭·러닝화·로컬 기록은 계속 사용할 수 있어야 한다.
- 데이터베이스 migration을 되돌리는 대신 forward fix migration을 만든다.
- 공개 저장소에 데이터베이스 dump를 올리지 않는다.

## Play 복구

현재 CODE_ONLY 단계에서는 Play 업로드가 차단돼 있다. 향후 승인된 artifact에 문제가 생기면 다음 순서를 따른다.

1. 진행 중 rollout 또는 게시를 중단한다.
2. 문제 artifact의 versionName, versionCode, source SHA, AAB SHA-256을 기록한다.
3. 마지막 정상 Git tag와 artifact를 확인한다.
4. 되돌림 호환성을 갖춘 forward fix를 만든다.
5. 이미 Play에 사용한 코드보다 높은 versionCode로 새 AAB를 만든다.
6. 내부 테스트 한 명으로 설치·업데이트·데이터 보존을 확인한다.
7. 별도 승인을 받은 뒤에만 다음 트랙으로 게시한다.

## 릴리스 가드

`.github/workflows/play-release.yml`은 수동 실행만 허용하며 source SHA, EAS build ID, AAB SHA-256, 승인 참조값, 보호 environment를 검사한다. `CLOSED_REVIEW` 실제 실행은 안전한 검토 전용 API가 없어서 의도적으로 실패한다.

## 현재 복구 가능 판정

기준 SHA, 구현 커밋과 CODE_ONLY 가드를 확인했다. Play 트랙은 변경하지 않았고, 위 명령으로 코드 변경을 원자적으로 되돌릴 수 있다. 이미 Play에 사용한 versionCode는 되돌림에서도 재사용하지 않는다.
