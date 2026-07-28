# V7 기능 보존 매트릭스

**UNMAPPED = 0**, **unreachable = 0**. 테스트 `v7-navigation.test.ts`가 이걸 지킵니다.

기능은 삭제하지 않습니다. 다음 중 하나로 처리합니다.

| 등급 | 뜻 |
|---|---|
| PRIMARY | 항상 보입니다 |
| CONTEXTUAL | 해당 상황일 때 자동으로 나타납니다 |
| SECONDARY | 그 목적지 안에서 한 번 더 들어가면 있습니다 |
| ADVANCED | 상세 설정 안에만 있습니다 |
| FEATURE_GATED | 준비가 끝났을 때만 보입니다 |
| DEVELOPER_ONLY | 일반 사용자에게 숨깁니다 |

## 목적지별 기능 수

| 목적지 | 기능 |
|---|---:|
| 오늘 | 4 |
| 훈련 | 8 |
| 달리기 | 7 |
| 찾기 | 5 |
| 나 | 17 |
| **합계** | **41** |

## 전체 매핑

| 기능 | 예전 위치 | 새 목적지 | 새 위치 | 노출 |
|---|---|---|---|---|
| 오늘 할 러닝 | 홈 hero + TodayCard (두 개로 나뉘어 있었음) | today | home > TodayAction | PRIMARY |
| 이번 주 목표 | 홈 카드 | today | home > WeekStrip · 상세는 stats > 분석 | CONTEXTUAL |
| 목표 대회 | 홈 카드 | today | home > RunRail · 상세는 races | CONTEXTUAL |
| 최근 기록 | 홈 카드 | today | home > 최근 1개 · 전체는 stats > 활동 기록 | CONTEXTUAL |
| 이번 달 지도 | 홈 MonthMapCard | me | badges > 성취 > 월간 지도 | SECONDARY |
| 지금 하는 계획 | 훈련 accordion 1 | training | programs > 내 계획 | PRIMARY |
| 훈련 계획 40개 | 훈련 accordion 1 안의 PlanPicker | training | programs > 내 계획 > 계획 찾기 | SECONDARY |
| 일회성 훈련 103개 | 훈련 accordion 2 | training | programs > 라이브러리 | SECONDARY |
| 도전 40개 | 훈련 accordion 3 | training | challenges (훈련 > 더 활용하기) | SECONDARY |
| 보조 프로젝트 20개 | 훈련 accordion 4 | training | programs > 더 활용하기 > 챙길 것 | SECONDARY |
| 박자 맞추기 · 케이던스 | 드로어 + 훈련 탭 매핑 | training | cadence (훈련 > 더 활용하기) · 달리기 준비에서도 바로 감 | SECONDARY |
| 일정 · 캘린더 | 드로어 | training | calendar (훈련 > 일정) | SECONDARY |
| 러닝 회고 · 몸 상태 | 훈련 화면 카드 | training | programs > 오늘 · 완료 화면 | CONTEXTUAL |
| 러닝 시작 | 홈 버튼 + 드로어 | run | start > RunDock | PRIMARY |
| 시간 · 거리 · 끝낼 때까지 | 시작 화면 slider + 칩 + 직접 입력 | run | start > 시간 sheet | PRIMARY |
| 러닝 유형 15종 | 시작 화면 유형 모달 | run | start > 유형 sheet | PRIMARY |
| V6 음성 코치 (성격 7 · 말투 · 말수 · 긴 이야기 46덩어리) | 설정 CoachPersonaCard + 시작 화면 안내 정도 | run | start > 코치 sheet · 상세는 settings > 코치·소리 | PRIMARY |
| GPS Preview 추적 · 자동 멈춤 · 구간 | 시작 화면 인라인 | run | start > 고급 · ActiveRun | ADVANCED |
| 몸무게 · 칼로리 | 시작 화면 입력 | me | settings > 달리는 중 > 고급 | ADVANCED |
| 카운트다운 | 시작 화면 | run | start > 고급 | SECONDARY |
| 야간 모드 | 시작 화면 | run | 자동 · settings > 달리는 중 | ADVANCED |
| 대회 목록 · 상세 · 접수 알림 | 탭 + 드로어 | explore | races > 대회 | PRIMARY |
| 대회 필터 10종 · 달력 보기 | 목록 위에 전부 펼쳐져 있었음 | explore | races > 필터 sheet · 보기 전환 | SECONDARY |
| 러닝화 123종 · 추천 · 가격 · 순위 | 탭 + 드로어 + 홈 순위 카드 | explore | shoes > 러닝화 | PRIMARY |
| 러닝화 비교 | 러닝화 화면 | explore | shoes > 비교 | SECONDARY |
| 러닝 지식 · Q&A | 드로어 + 훈련 탭 매핑 + 홈 카드 | explore | guide > 러닝 지식 | SECONDARY |
| 활동 기록 · 필터 · 수동 기록 | 기록 탭 | me | stats > 활동 기록 | PRIMARY |
| 주·월 통계 · 추이 · 최고기록 | 기록 탭 한 스크롤 | me | stats > 분석 | SECONDARY |
| 배지 48개 | 드로어 + 기록 탭 | me | badges > 성취 | SECONDARY |
| 보관함 — 관심 대회 · 관심 러닝화 · 내 신발 | 프로필 안 러닝화 검색 + 대회 화면 | me | profile > 보관함 | SECONDARY |
| 프로필 — 닉네임 · 소개 · 경력 · 동네 | 프로필 화면(러닝화 카탈로그가 섞여 있었음) | me | profile > 프로필 | SECONDARY |
| 기록 공유 카드 · 임시 글 | 커뮤니티 화면 | me | community > 공유 기록 · 완료 화면 | CONTEXTUAL |
| 사람들 소식 · 크루 · 리그 | 커뮤니티 화면에 "준비 중"으로 상시 노출 | me | community (서버가 준비된 경우에만 노출) | FEATURE_GATED |
| 설정 — 코치·소리 | 설정 한 스크롤 | me | settings > 코치·소리 | SECONDARY |
| 설정 — 달리는 중 | 설정 한 스크롤 | me | settings > 달리는 중 | SECONDARY |
| 설정 — 알림·권한 | 설정 한 스크롤 | me | settings > 알림·권한 | SECONDARY |
| 설정 — 계정·백업 | 설정 한 스크롤(비활성 provider 목록까지 노출) | me | settings > 계정·백업 | ADVANCED |
| 설정 — 개인정보·데이터 (내보내기·삭제) | 설정 한 스크롤 | me | settings > 개인정보·데이터 | ADVANCED |
| 설정 — 앱 정보·도움말 | 설정 한 스크롤 + 드로어 도움말 | me | help > 앱 정보·도움말 | SECONDARY |
| versionCode · SHA · 데이터 revision · DB schema | 설정 첫 화면에 그대로 노출 | me | help > 앱 정보 > 진단 (명시적으로 열어야 함) | DEVELOPER_ONLY |
| 목소리 고르기 | 드로어 + 설정 | me | voice (settings > 코치·소리 > 목소리) | SECONDARY |

## 보존하는 저장 키 (17개)

이 키들은 **바뀌지 않습니다.** 테스트가 실제 코드에 존재하는지도 함께 확인합니다.

- `runningbom.projects.v1`
- `runningbom.retrospect.v1`
- `runningbom:auth:access`
- `runningbom:auth:refresh`
- `runningbom:coaching:settings:v1`
- `runningbom:coaching:voice-pick:v1`
- `runningbom:coaching:voice:v1`
- `runningbom:run-experience:v1`
- `runningbom:vnext:challenges:v1`
- `runningbom:vnext:community-drafts:v1`
- `runningbom:vnext:goal-race:v1`
- `runningbom:vnext:local-uuid`
- `runningbom:vnext:permission-ledger:v1`
- `runningbom:vnext:preferences:v1`
- `runningbom:vnext:programs:v1`
- `runningbom:vnext:run-plans:v1`
- `runningbom:vnext:weekly-goal:v1`
