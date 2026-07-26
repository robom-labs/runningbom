// Google Play 작업 전에 단계, 대상, 산출물과 승인 근거를 fail-closed로 검증한다.
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const REQUIRED_BOOLEAN_KEYS = [
  "playInternalAllowed",
  "playClosedReviewAllowed",
  "playClosedPublishAllowed",
  "playProductionAllowed",
];

const STAGE_POLICIES = Object.freeze({
  CODE_ONLY: {
    playInternalAllowed: false,
    playClosedReviewAllowed: false,
    playClosedPublishAllowed: false,
    playProductionAllowed: false,
    intents: [],
  },
  INTERNAL_TEST: {
    playInternalAllowed: true,
    playClosedReviewAllowed: false,
    playClosedPublishAllowed: false,
    playProductionAllowed: false,
    intents: [["internal", "INTERNAL_TEST"]],
  },
  CLOSED_REVIEW: {
    playInternalAllowed: false,
    playClosedReviewAllowed: true,
    playClosedPublishAllowed: false,
    playProductionAllowed: false,
    intents: [["closed", "CLOSED_REVIEW"]],
  },
  CLOSED_PUBLISH: {
    playInternalAllowed: false,
    playClosedReviewAllowed: true,
    playClosedPublishAllowed: true,
    playProductionAllowed: false,
    intents: [
      ["closed", "CLOSED_REVIEW"],
      ["closed", "CLOSED_PUBLISH"],
    ],
  },
  PRODUCTION: {
    playInternalAllowed: false,
    playClosedReviewAllowed: false,
    playClosedPublishAllowed: false,
    playProductionAllowed: true,
    intents: [["production", "PRODUCTION"]],
  },
});

const KNOWN_OPTIONS = new Set([
  "stage-file",
  "target-track",
  "intent",
  "artifact",
  "artifact-sha256",
  "source-sha",
  "approval-reference",
  "approval-file",
  "mode",
]);

function fail(message) {
  console.error(`RELEASE_GUARD: DENY — ${message}`);
  process.exitCode = 1;
}

function parseArguments(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || value === undefined) {
      throw new Error("모든 옵션은 --이름 값 형식이어야 합니다.");
    }

    const key = flag.slice(2);
    if (!KNOWN_OPTIONS.has(key)) {
      throw new Error(`알 수 없는 옵션입니다: --${key}`);
    }
    if (Object.hasOwn(parsed, key)) {
      throw new Error(`중복 옵션입니다: --${key}`);
    }
    parsed[key] = value;
  }

  for (const key of KNOWN_OPTIONS) {
    if (!parsed[key]) {
      throw new Error(`필수 옵션이 없습니다: --${key}`);
    }
  }
  return parsed;
}

function validateApprovalReference(reference) {
  const normalized = reference.trim();
  const blocked = new Set([
    "none",
    "n/a",
    "na",
    "test",
    "todo",
    "tbd",
    "placeholder",
    "unknown",
  ]);

  if (
    normalized.length < 8 ||
    normalized.length > 200 ||
    blocked.has(normalized.toLowerCase()) ||
    !/^[A-Za-z0-9가-힣][A-Za-z0-9가-힣._:/#@ -]*$/.test(normalized)
  ) {
    throw new Error("approval reference가 비어 있거나 임시값입니다.");
  }
}

function parseApprovalFields(section) {
  const fields = new Map();
  for (const line of section) {
    const match = line.match(/^\s*-\s*([^:]+):\s*(.+?)\s*$/);
    if (match) {
      fields.set(match[1].trim().toLowerCase(), match[2].trim());
    }
  }
  return fields;
}

async function validateApprovalRecord(filePath, reference, expected) {
  const approvalText = await readFile(filePath, "utf8");
  const lines = approvalText.split(/\r?\n/);
  const heading = `## ${reference.trim()}`;
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start < 0) {
    throw new Error(
      "approval reference와 일치하는 승인 기록이 approval file에 없습니다.",
    );
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) {
      end = index;
      break;
    }
  }

  const fields = parseApprovalFields(lines.slice(start + 1, end));
  const required = new Map([
    ["status", "APPROVED"],
    ["source sha", expected.sourceSha],
    ["aab sha-256", expected.artifactSha256],
    ["target track", expected.targetTrack],
    ["intent", expected.intent],
  ]);

  for (const [key, value] of required) {
    const actual = fields.get(key);
    if (!actual || actual.toLowerCase() !== value.toLowerCase()) {
      throw new Error(
        `승인 기록의 ${key} 값이 실행 입력과 일치하지 않습니다.`,
      );
    }
  }
}

function gitHead() {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function sha256(filePath) {
  const contents = await readFile(filePath);
  return createHash("sha256").update(contents).digest("hex");
}

function validateAabStructure(filePath, size) {
  if (size < 64 * 1024) {
    throw new Error("artifact가 정상적인 Android App Bundle 크기가 아닙니다.");
  }

  let entries;
  try {
    entries = execFileSync("unzip", ["-Z1", filePath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    throw new Error("artifact가 읽을 수 있는 ZIP 기반 App Bundle이 아닙니다.");
  }

  const requiredEntries = [
    ["BundleConfig.pb", (entry) => entry === "BundleConfig.pb"],
    [
      "base manifest",
      (entry) => entry === "base/manifest/AndroidManifest.xml",
    ],
    ["base dex", (entry) => /^base\/dex\/classes(?:\d+)?\.dex$/.test(entry)],
  ];
  for (const [label, matches] of requiredEntries) {
    if (!entries.some(matches)) {
      throw new Error(`artifact에 필수 AAB 항목이 없습니다: ${label}`);
    }
  }
}

async function run() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    fail(error.message);
    return;
  }

  try {
    const stagePath = path.resolve(options["stage-file"]);
    const artifactPath = path.resolve(options.artifact);
    const stageConfig = JSON.parse(await readFile(stagePath, "utf8"));
    const policy = STAGE_POLICIES[stageConfig.stage];

    if (stageConfig.schemaVersion !== 1 || !policy) {
      throw new Error("알 수 없는 release stage schema 또는 stage입니다.");
    }

    for (const key of REQUIRED_BOOLEAN_KEYS) {
      if (
        typeof stageConfig[key] !== "boolean" ||
        stageConfig[key] !== policy[key]
      ) {
        throw new Error(
          `${stageConfig.stage} 단계의 ${key} 값이 정책과 일치하지 않습니다.`,
        );
      }
    }

    const allowed = policy.intents.some(
      ([track, intent]) =>
        track === options["target-track"] && intent === options.intent,
    );
    if (!allowed) {
      throw new Error(
        `${stageConfig.stage} 단계는 ${options["target-track"]}/${options.intent} 작업을 허용하지 않습니다.`,
      );
    }

    if (!["dry-run", "execute"].includes(options.mode)) {
      throw new Error("mode는 dry-run 또는 execute만 허용됩니다.");
    }

    if (!/^[a-f0-9]{64}$/i.test(options["artifact-sha256"])) {
      throw new Error("artifact SHA-256은 64자리 16진수여야 합니다.");
    }
    if (!/^[a-f0-9]{40}$/i.test(options["source-sha"])) {
      throw new Error("source SHA는 전체 40자리 Git SHA여야 합니다.");
    }
    validateApprovalReference(options["approval-reference"]);

    const artifactStat = await stat(artifactPath);
    if (!artifactStat.isFile() || path.extname(artifactPath) !== ".aab") {
      throw new Error("artifact는 실제 .aab 파일이어야 합니다.");
    }
    validateAabStructure(artifactPath, artifactStat.size);

    const actualArtifactSha = await sha256(artifactPath);
    if (
      actualArtifactSha.toLowerCase() !==
      options["artifact-sha256"].toLowerCase()
    ) {
      throw new Error("artifact SHA-256이 실제 파일과 일치하지 않습니다.");
    }

    const currentHead = gitHead();
    if (currentHead.toLowerCase() !== options["source-sha"].toLowerCase()) {
      throw new Error("source SHA가 현재 checkout HEAD와 일치하지 않습니다.");
    }
    if (
      process.env.GITHUB_SHA &&
      process.env.GITHUB_SHA.toLowerCase() !==
        options["source-sha"].toLowerCase()
    ) {
      throw new Error("source SHA가 GITHUB_SHA와 일치하지 않습니다.");
    }

    await validateApprovalRecord(
      path.resolve(options["approval-file"]),
      options["approval-reference"],
      {
        sourceSha: options["source-sha"],
        artifactSha256: actualArtifactSha,
        targetTrack: options["target-track"],
        intent: options.intent,
      },
    );

    if (options.mode === "execute") {
      const expectedEnvironment = `play-${options["target-track"]}-approval`;
      if (
        process.env.GITHUB_ACTIONS !== "true" ||
        process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
        process.env.RELEASE_EXECUTION_CONFIRMED !== "true" ||
        process.env.PLAY_RELEASE_ENVIRONMENT_GUARD !== "configured" ||
        process.env.PLAY_RELEASE_ENVIRONMENT_NAME !== expectedEnvironment
      ) {
        throw new Error(
          "execute는 설정이 확인된 보호 environment의 workflow_dispatch 실행에서만 허용됩니다.",
        );
      }
    }

    console.log(
      JSON.stringify(
        {
          result: "ALLOW",
          mode: options.mode,
          stage: stageConfig.stage,
          targetTrack: options["target-track"],
          intent: options.intent,
          artifactSha256: actualArtifactSha,
          sourceSha: currentHead,
          approvalReference: options["approval-reference"],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    fail(error.message);
  }
}

await run();
