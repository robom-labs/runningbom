// 운영 Pages와 GitHub main의 대회 정본이 최신·동일·무결한지 독립적으로 확인한다.
import { createHash } from "node:crypto";
import { assessRaceDataset } from "./race-health-core.mjs";

const productionUrl = process.env.RUNNINGBOM_RACES_URL
  || "https://robom-labs.github.io/runningbom/races.json";
const sourceUrl = process.env.RUNNINGBOM_SOURCE_URL
  || "https://raw.githubusercontent.com/robom-labs/runningbom/main/outputs/pushrun-site/races.json";

async function fetchDataset(url) {
  const target = new URL(url);
  target.searchParams.set("watchdog", String(Date.now()));
  const response = await fetch(target, {
    headers: { accept: "application/json", "user-agent": "RunningBomWatchdog/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${url} 응답 실패: HTTP ${response.status}`);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${url} 응답이 올바른 JSON이 아닙니다.`);
  }
  return { data, sha256: createHash("sha256").update(text).digest("hex") };
}

const [production, source] = await Promise.all([
  fetchDataset(productionUrl),
  fetchDataset(sourceUrl),
]);
const now = Date.now();
const productionHealth = assessRaceDataset({ data: production.data, now });
const sourceHealth = assessRaceDataset({ data: source.data, now });
const errors = [
  ...productionHealth.errors.map((error) => `운영: ${error}`),
  ...sourceHealth.errors.map((error) => `main: ${error}`),
];
if (production.sha256 !== source.sha256) {
  errors.push(`운영 정본과 main 정본이 다릅니다: 운영 ${production.data?.version}, main ${source.data?.version}`);
}

const result = {
  ok: errors.length === 0,
  errors,
  production: productionHealth.metrics,
  source: sourceHealth.metrics,
  identical: production.sha256 === source.sha256,
};
console.log(JSON.stringify(result));
if (!result.ok) process.exitCode = 1;
