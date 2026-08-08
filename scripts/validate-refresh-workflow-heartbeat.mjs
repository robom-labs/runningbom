// 최근 예약 수집 실행이 성공했고 다음 주기 전까지 살아 있는지 판정한다.
const runs = JSON.parse(process.env.RUN_JSON || "[]");
const run = runs[0];
if (!run) throw new Error("자동 수집 실행 이력이 없습니다.");
const ageHours = (Date.now() - Date.parse(run.updatedAt)) / 3_600_000;
if (run.status !== "completed" || run.conclusion !== "success") {
  throw new Error(`최근 자동 수집이 성공 상태가 아닙니다: ${run.status}/${run.conclusion} ${run.url}`);
}
if (!Number.isFinite(ageHours) || ageHours > 10) {
  throw new Error(`최근 자동 수집 성공이 ${Math.round(ageHours)}시간 전입니다: ${run.url}`);
}
console.log(JSON.stringify({ workflow: "healthy", ageHours: Number(ageHours.toFixed(1)), url: run.url }));
