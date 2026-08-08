// 릴리스 가드의 허용·차단 조건을 외부 Play 작업 없이 회귀 검증한다.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const guardPath = path.join(
  repositoryRoot,
  "scripts/release/assert-release-intent.mjs",
);
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: repositoryRoot,
  encoding: "utf8",
}).trim();

const stageFlags = {
  CODE_ONLY: [false, false, false, false],
  INTERNAL_TEST: [true, false, false, false],
  CLOSED_REVIEW: [false, true, false, false],
  CLOSED_PUBLISH: [false, true, true, false],
  PRODUCTION: [false, false, false, true],
};

const approvalByStage = {
  CODE_ONLY: ["internal", "INTERNAL_TEST"],
  INTERNAL_TEST: ["internal", "INTERNAL_TEST"],
  CLOSED_REVIEW: ["closed", "CLOSED_REVIEW"],
  CLOSED_PUBLISH: ["closed", "CLOSED_PUBLISH"],
  PRODUCTION: ["production", "PRODUCTION"],
};

async function fixture(stage, overrides = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "runningbom-release-"));
  const artifactPath = path.join(directory, "candidate.aab");
  const stagePath = path.join(directory, "stage.json");
  const approvalPath = path.join(directory, "approvals.md");
  const aabSource = path.join(directory, "aab");
  const [internal, closedReview, closedPublish, production] =
    stageFlags[stage];
  const [approvalTrack, approvalIntent] = approvalByStage[stage];

  await mkdir(path.join(aabSource, "base/manifest"), { recursive: true });
  await mkdir(path.join(aabSource, "base/dex"), { recursive: true });
  await writeFile(path.join(aabSource, "BundleConfig.pb"), randomBytes(512));
  await writeFile(
    path.join(aabSource, "base/manifest/AndroidManifest.xml"),
    randomBytes(4096),
  );
  await writeFile(
    path.join(aabSource, "base/dex/classes.dex"),
    randomBytes(128 * 1024),
  );
  execFileSync(
    "zip",
    [
      "-q",
      "-r",
      artifactPath,
      "BundleConfig.pb",
      "base/manifest/AndroidManifest.xml",
      "base/dex/classes.dex",
    ],
    { cwd: aabSource },
  );
  const artifact = await import("node:fs/promises").then(({ readFile }) =>
    readFile(artifactPath),
  );
  const artifactSha = createHash("sha256").update(artifact).digest("hex");
  await writeFile(
    stagePath,
    JSON.stringify({
      schemaVersion: 1,
      stage,
      playInternalAllowed: internal,
      playClosedReviewAllowed: closedReview,
      playClosedPublishAllowed: closedPublish,
      playProductionAllowed: production,
      ...overrides,
    }),
  );
  await writeFile(
    approvalPath,
    [
      "# Test approvals",
      "",
      "## CEO-APPROVAL-2026-0001",
      "",
      "- Status: APPROVED",
      `- Source SHA: ${head}`,
      `- AAB SHA-256: ${artifactSha}`,
      `- Target track: ${approvalTrack}`,
      `- Intent: ${approvalIntent}`,
      "",
    ].join("\n"),
  );

  return {
    artifactPath,
    stagePath,
    approvalPath,
    artifactSha,
  };
}

function invoke({
  stagePath,
  artifactPath,
  artifactSha,
  targetTrack = "internal",
  intent = "INTERNAL_TEST",
  sourceSha = head,
  approvalReference = "CEO-APPROVAL-2026-0001",
  approvalPath,
  mode = "dry-run",
  env = {},
}) {
  return spawnSync(
    process.execPath,
    [
      guardPath,
      "--stage-file",
      stagePath,
      "--target-track",
      targetTrack,
      "--intent",
      intent,
      "--artifact",
      artifactPath,
      "--artifact-sha256",
      artifactSha,
      "--source-sha",
      sourceSha,
      "--approval-reference",
      approvalReference,
      "--approval-file",
      approvalPath,
      "--mode",
      mode,
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, ...env },
    },
  );
}

test("기본 CODE_ONLY는 모든 Play 의도를 차단한다", async () => {
  const values = await fixture("CODE_ONLY");
  const result = invoke(values);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /CODE_ONLY 단계는/);
});

test("INTERNAL_TEST는 internal 의도만 dry-run 허용한다", async () => {
  const values = await fixture("INTERNAL_TEST");
  const result = invoke(values);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"result": "ALLOW"/);
});

test("INTERNAL_TEST에서 closed 대상을 차단한다", async () => {
  const values = await fixture("INTERNAL_TEST");
  const result = invoke({
    ...values,
    targetTrack: "closed",
    intent: "CLOSED_REVIEW",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /허용하지 않습니다/);
});

for (const [stage, targetTrack, intent] of [
  ["CLOSED_REVIEW", "closed", "CLOSED_REVIEW"],
  ["CLOSED_PUBLISH", "closed", "CLOSED_PUBLISH"],
  ["PRODUCTION", "production", "PRODUCTION"],
]) {
  test(`${stage}는 대응하는 ${targetTrack}/${intent} dry-run을 허용한다`, async () => {
    const values = await fixture(stage);
    const result = invoke({
      ...values,
      targetTrack,
      intent,
    });
    assert.equal(result.status, 0, result.stderr);
  });
}

test("target과 intent 조합이 다르면 차단한다", async () => {
  const values = await fixture("PRODUCTION");
  const result = invoke({
    ...values,
    targetTrack: "production",
    intent: "INTERNAL_TEST",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /허용하지 않습니다/);
});

test("단계 boolean을 임의 완화하면 차단한다", async () => {
  const values = await fixture("CODE_ONLY", {
    playInternalAllowed: true,
  });
  const result = invoke(values);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /정책과 일치하지 않습니다/);
});

test("artifact checksum 불일치를 차단한다", async () => {
  const values = await fixture("INTERNAL_TEST");
  const result = invoke({
    ...values,
    artifactSha: "0".repeat(64),
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SHA-256이 실제 파일과/);
});

test("이름만 aab인 가짜 artifact를 차단한다", async () => {
  const values = await fixture("INTERNAL_TEST");
  const fakeArtifact = Buffer.from("not-an-android-app-bundle");
  await writeFile(values.artifactPath, fakeArtifact);
  const result = invoke({
    ...values,
    artifactSha: createHash("sha256").update(fakeArtifact).digest("hex"),
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /App Bundle 크기|ZIP 기반/);
});

test("후보 source SHA는 승인 기록과 일치하면 control checkout과 달라도 허용한다", async () => {
  const values = await fixture("INTERNAL_TEST");
  const candidateSource = "0".repeat(40);
  await writeFile(
    values.approvalPath,
    [
      "# Test approvals",
      "",
      "## CEO-APPROVAL-2026-0001",
      "",
      "- Status: APPROVED",
      `- Source SHA: ${candidateSource}`,
      `- AAB SHA-256: ${values.artifactSha}`,
      "- Target track: internal",
      "- Intent: INTERNAL_TEST",
      "",
    ].join("\n"),
  );
  const result = invoke({
    ...values,
    sourceSha: candidateSource,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"controlSha"/);
});

test("후보 source SHA가 승인 기록과 다르면 차단한다", async () => {
  const values = await fixture("INTERNAL_TEST");
  const result = invoke({
    ...values,
    sourceSha: "0".repeat(40),
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /source sha 값/);
});

test("임시 approval reference를 차단한다", async () => {
  const values = await fixture("INTERNAL_TEST");
  const result = invoke({
    ...values,
    approvalReference: "TODO",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /임시값/);
});

test("승인 문서에 없는 reference를 차단한다", async () => {
  const values = await fixture("INTERNAL_TEST");
  const result = invoke({
    ...values,
    approvalReference: "CEO-APPROVAL-2026-9999",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /승인 기록/);
});

test("승인 문서의 artifact SHA가 다르면 차단한다", async () => {
  const values = await fixture("INTERNAL_TEST");
  await writeFile(
    values.approvalPath,
    [
      "# Test approvals",
      "",
      "## CEO-APPROVAL-2026-0001",
      "",
      "- Status: APPROVED",
      `- Source SHA: ${head}`,
      `- AAB SHA-256: ${"0".repeat(64)}`,
      "- Target track: internal",
      "- Intent: INTERNAL_TEST",
      "",
    ].join("\n"),
  );
  const result = invoke(values);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /aab sha-256 값/);
});

test("execute는 승인된 workflow_dispatch 환경 밖에서 차단한다", async () => {
  const values = await fixture("INTERNAL_TEST");
  const result = invoke({
    ...values,
    mode: "execute",
    env: {
      GITHUB_ACTIONS: "false",
      GITHUB_EVENT_NAME: "push",
      RELEASE_EXECUTION_CONFIRMED: "false",
      PLAY_RELEASE_ENVIRONMENT_GUARD: "",
      PLAY_RELEASE_ENVIRONMENT_NAME: "",
    },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /workflow_dispatch/);
});

test("execute 가드는 승인 환경 신호가 모두 맞을 때만 통과한다", async () => {
  const values = await fixture("INTERNAL_TEST");
  const result = invoke({
    ...values,
    mode: "execute",
    env: {
      GITHUB_ACTIONS: "true",
      GITHUB_EVENT_NAME: "workflow_dispatch",
      RELEASE_EXECUTION_CONFIRMED: "true",
      PLAY_RELEASE_ENVIRONMENT_GUARD: "configured",
      PLAY_RELEASE_ENVIRONMENT_NAME: "play-internal-approval",
      GITHUB_SHA: head,
      GITHUB_REF: "refs/heads/main",
    },
  });
  assert.equal(result.status, 0, result.stderr);
});

test("execute는 main이 아닌 release control ref를 차단한다", async () => {
  const values = await fixture("INTERNAL_TEST");
  const result = invoke({
    ...values,
    mode: "execute",
    env: {
      GITHUB_ACTIONS: "true",
      GITHUB_EVENT_NAME: "workflow_dispatch",
      RELEASE_EXECUTION_CONFIRMED: "true",
      PLAY_RELEASE_ENVIRONMENT_GUARD: "configured",
      PLAY_RELEASE_ENVIRONMENT_NAME: "play-internal-approval",
      GITHUB_SHA: head,
      GITHUB_REF: "refs/heads/release-candidate",
    },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /workflow_dispatch/);
});

test("workflow는 수동 실행과 보호 environment만 선언한다", async () => {
  const workflow = await import("node:fs/promises").then(({ readFile }) =>
    readFile(
      path.join(repositoryRoot, ".github/workflows/play-release.yml"),
      "utf8",
    ),
  );
  assert.match(workflow, /\n\s*workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n\s*(push|pull_request|schedule):/);
  assert.match(workflow, /environment:\s*\n\s*name: play-/);
  assert.match(workflow, /assert-release-intent\.mjs/);
  assert.match(workflow, /--approval-file/);
  assert.match(workflow, /bundletool-all-1\.18\.3\.jar/);
  assert.match(workflow, /PLAY_RELEASE_ENVIRONMENT_GUARD/);
  assert.match(workflow, /eas-cli@16\.19\.0 submit/);
  assert.doesNotMatch(workflow, /ref:\s*\$\{\{\s*inputs\.source_sha/);
  assert.ok(
    workflow.indexOf("--mode dry-run") <
      workflow.indexOf("name: Protected submit"),
  );
  assert.ok(
    workflow.lastIndexOf("--mode execute") <
      workflow.indexOf("eas-cli@16.19.0 submit"),
  );
});
