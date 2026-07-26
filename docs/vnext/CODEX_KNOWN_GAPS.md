# Codex Known Gaps

## CODE_ONLY 후보의 의도적 차단

- Supabase production project를 연결하지 않았다. 앱은 `CORE_ONLY`로 동작한다.
- Google·Kakao·Naver·Apple 로그인 버튼은 credential이 없으므로 노출하지 않는다.
- 커뮤니티 쓰기, 크루 가입·생성, 공개 리그 정산은 운영 RLS·moderation 검증 전까지 비활성이다.
- 위치 기반 동네 확인은 공식 경계 데이터 라이선스와 실기기 검증 전까지 비활성이다.
- GPS 경로, Health Connect, 실시간 위치, DM, 게시물 미디어, 광고, 유료 기능은 범위에서 제외했다.

## 실제 기기에서만 닫을 수 있는 위험

- Android foreground service와 기기 한국어 TTS의 제조사별 장시간 안정성
- 전화·오디오 포커스·Bluetooth·이어폰 해제 복구
- 실제 배터리 사용량과 메모리 누수
- TalkBack과 큰 글자에서의 전체 흐름
- 기존 v0.18.3 설치 데이터 보존 업데이트

## 보안·운영 외부 항목

- 운영 Supabase에서 서로 다른 JWT를 사용한 RLS 공격 테스트
- OAuth 공급자 콘솔 설정과 실제 로그인
- UGC 운영자 큐, 신고 처리, 이의제기 운영 훈련
- Play 전경 서비스·Data Safety·Health Apps·UGC 양식
- Play app signing certificate SHA-256의 최신 화면 대조

이 항목들은 숨기지 않고 Claude Code와 CEO 인계 대상으로 남긴다.
