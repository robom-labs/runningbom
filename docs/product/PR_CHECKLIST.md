# 제품 감사 PR 검증 체크리스트

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run verify`
- [ ] `npm run config`
- [ ] Preview Android 실제 기기: 100m 이동 → 수동 일시정지 → 400m 이동 → 재개 → 20m 이동 시 기록 약 120m
- [ ] 자동 멈춤 상태에서 거리 증가 없음
- [ ] 수동 일시정지 동안 평균 페이스 악화 없음
- [ ] 종료 기록의 1km 구간과 총거리가 일치
- [ ] 기존 저장 키·활동 ID·대회 ID 변경 없음
- [ ] 정식 Production 권한 변경 없음
