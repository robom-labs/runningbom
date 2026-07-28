# Codex Remote 시작문구 — 러닝봄 V6 2차 감사·수정

아래 문장을 Codex Remote 채팅창에 그대로 붙여 넣는다.

```text
러닝봄 V6의 Claude Code 1차 결과를 독립적으로 감사하고 직접 수정해라.

작업을 시작하기 전에 저장소 안의 다음 파일을 처음부터 끝까지 전문으로 읽어라.

docs/codex-handoff/runningbom-v6/02_CODEX_SECOND_PASS.txt

Claude Code 1차 결과:

PR:
브랜치:
HEAD SHA:

위 세 값이 비어 있으면 현재 저장소의 열린 PR, 브랜치와 최근 커밋에서 다음 키워드와 관련된 최신 1차 작업을 직접 찾아라.

- RunningBom V6
- continuous human coach
- full-talk coach
- audio coach
- form coach
- metronome
- open-ended running

오래된 작업을 임의로 선택하지 말고, 최신 origin/main과 merge base를 확인한 뒤 실제 diff와 runtime을 기준으로 판단해라.

Claude의 완료 보고를 사실로 믿지 마라. 문서에만 있거나 테스트에만 있는 기능은 완료가 아니다. 실제 코드, 화면, 저장, background runtime, 음성 타임라인, 장시간 시뮬레이션과 CI를 처음부터 독립적으로 재검증해라.

특히 다음을 파괴적으로 검증해라.

- 특정 50분 실행에 종속되지 않았는지
- 3분·5분·30분·49분·50분·51분·90분·121분·3시간·6시간·오픈엔드에서 정상인지
- 사용자가 마무리를 누르기 전에 종료성 문구가 나오지 않는지
- 풀토크 모드에서 의도하지 않은 긴 침묵, TTS 공백과 문장 반복이 없는지
- 존댓말·반말과 각 코치 성격이 실제로 다른지
- 실제 자세를 감지했다고 거짓말하지 않는지
- 상체 15도, 170·180보, 특정 착지를 모든 사람의 정답으로 강요하지 않는지
- 매운맛 모드가 기본 OFF이며 성인 동의·허용목록·금지표현 정책을 지키는지
- 캐릭터·유튜버·연예인의 목소리·대사·말버릇을 침해하지 않는지
- 사람 녹음이 없는데 인간 음성 완성이라고 주장하지 않는지
- 음악·팟캐스트·통화·Bluetooth·화면 잠금에서 오디오 포커스가 정상인지
- 메트로놈이 JS 타이머가 아니라 안정적인 오디오 시계를 사용하는지
- 몇 시간 실행해도 큐·메모리·캐시가 무한히 증가하지 않는지
- 기존 사용자 기록, 프로그램 진행, 저장 키와 앱 식별자가 깨지지 않는지
- Play 심사 중인 Production에 승인되지 않은 권한·native dependency가 섞이지 않았는지

문제를 발견하면 보고만 하지 말고 직접 수정하고 전체 회귀검사를 통과시켜라. Claude 브랜치 위에 보완 커밋을 만들거나 최신 main 기반 Codex 보완 브랜치를 만들고, 보완 PR 또는 명확한 수정 커밋으로 남겨라.

실기기, 사람 청취, 실제 성우 녹음과 스토어 정책처럼 자동으로 확인할 수 없는 항목은 DEVICE_REQUIRED, HUMAN_LISTENING_REQUIRED, BLOCKED_CEO_AUDIO_RECORDING, POLICY_REVIEW_REQUIRED로 정확히 분리해라.

증거 없이 완벽하다고 보고하지 말고 지금 시작해라.
```
