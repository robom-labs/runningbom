// 실제 HTTPS 응답을 확인해 정적 대회 데이터에서 안전한 외부 링크만 남긴다.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectRegistrationLinks } from "./link-healthcheck-core.mjs";
import { applyHttpsAudit } from "./secure-link-core.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = resolve(root, "outputs/pushrun-site/races.json");
const reportPath = resolve(root, "outputs/link-security-report.json");
const timeoutMs = 12_000;
const concurrency = 6;
const write = process.argv.includes("--write");
const data = JSON.parse(await readFile(dataPath, "utf8"));
const httpLinks = collectRegistrationLinks(data).filter((link) => link.url.startsWith("http://"));

async function checkHttps(link) {
  const candidate = link.url.replace(/^http:/, "https:");
  try {
    let response;
    try {
      response = await fetch(candidate, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
      if (response.status === 405 || response.status === 501) {
        response = await fetch(candidate, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
      }
    } catch {
      response = await fetch(candidate, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    }
    return {
      raw: link.url,
      candidate,
      status: response.status,
      finalUrl: response.url,
      usable: response.status >= 200 && response.status < 400 && response.url.startsWith("https://"),
    };
  } catch (error) {
    return { raw: link.url, candidate, usable: false, error: error?.message || String(error) };
  }
}

async function runPool(items, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

const results = await runPool(httpLinks, checkHttps);
const applied = applyHttpsAudit(data, results);
const report = {
  checkedAt: new Date().toISOString(),
  sourceHttpLinks: httpLinks.length,
  secureUrls: results.filter((result) => result.usable).length,
  unresolvedUrls: results.filter((result) => !result.usable).length,
  fieldChanges: applied.summary,
  results,
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

if (write) await writeFile(dataPath, `${JSON.stringify(applied.data, null, 2)}\n`);
console.log(`HTTPS 링크 감사: 주소 ${report.sourceHttpLinks}개 · 전환 ${report.secureUrls}개 · 제거 대상 ${report.unresolvedUrls}개 · 필드 전환 ${applied.summary.upgraded}개 · 필드 제거 ${applied.summary.removed}개`);
