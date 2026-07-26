<!-- Google Play 단계 변경과 외부 게시 승인 근거를 기록하는 운영 문서다. -->
# CEO approvals

현재 기본 상태는 `CODE_ONLY`이며 Play 트랙 변경은 모두 금지됩니다.

## 승인 기록 형식

외부 Play 작업이 필요한 별도 요청이 있을 때 다음 항목을 먼저 기록합니다.

- 승인 참조값
- 승인 시각
- 승인자
- 대상 버전과 versionCode
- source SHA
- AAB SHA-256
- 대상 트랙
- 허용 의도
- 롤백 기준

승인 참조값은 workflow 입력과 동일해야 하며 `TODO`, `test`, `N/A` 같은 임시값은 가드가 거부합니다.
가드는 승인 참조값만 보지 않고 아래 구조의 승인 기록에서 source SHA, AAB SHA-256, 대상 트랙과 의도가 실행 입력과 모두 같은지 검사합니다.

```md
## CEO-APPROVAL-YYYY-NNNN

- Status: APPROVED
- Source SHA: 40자리 Git SHA
- AAB SHA-256: 64자리 SHA-256
- Target track: internal | closed | production
- Intent: INTERNAL_TEST | CLOSED_REVIEW | CLOSED_PUBLISH | PRODUCTION
```

현재 문서에는 실행 가능한 승인 기록이 없습니다. `CODE_ONLY` 작업은 Play 제출을 허용하지 않습니다.

## 단계별 허용 범위

| stage | target | intent | 외부 영향 |
| --- | --- | --- | --- |
| `CODE_ONLY` | 없음 | 없음 | Play 변경 불가 |
| `INTERNAL_TEST` | `internal` | `INTERNAL_TEST` | 내부 테스트 업로드 |
| `CLOSED_REVIEW` | `closed` | `CLOSED_REVIEW` | 검토 전용 계획만 허용 |
| `CLOSED_PUBLISH` | `closed` | `CLOSED_REVIEW`, `CLOSED_PUBLISH` | 비공개 테스트 게시 |
| `PRODUCTION` | `production` | `PRODUCTION` | 프로덕션 게시 |

`CLOSED_REVIEW`는 EAS Submit이 검토 후 자동 게시를 막는다는 보장이 없으므로 현재 workflow에서 실제 실행을 거부합니다.

## GitHub environment 필수 설정

저장소 관리자만 다음 environment를 만들고 required reviewer를 지정해야 합니다.

- `play-internal-approval`
- `play-closed-approval`
- `play-production-approval`

각 environment에는 필요한 경우에만 `EXPO_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_JSON`을 등록합니다. 코드 저장소에는 인증 정보를 넣지 않습니다.
required reviewer를 설정한 뒤 environment secret `PLAY_RELEASE_ENVIRONMENT_GUARD=configured`도 등록해야 합니다. 이 secret이 없으면 보호 job까지 진입해도 execute guard가 거부합니다.
