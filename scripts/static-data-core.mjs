// 정적 데이터 파일의 결정적 직렬화와 manifest 무결성 계산을 담당한다.
import { createHash } from "node:crypto";

export const STATIC_DATA_FILES = Object.freeze([
  "races.json",
  "shoes.json",
  "upcoming-shoes.json",
  "coaching.json",
]);

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function byteSize(value) {
  return Buffer.byteLength(value, "utf8");
}

export function contentVersionFor(checksums) {
  const input = STATIC_DATA_FILES.map((fileName) => `${fileName}:${checksums[fileName]}`).join("\n");
  return `static-${sha256Text(input).slice(0, 20)}`;
}

export function latestIso(values) {
  const timestamps = values.map((value) => Date.parse(value));
  if (timestamps.some((value) => !Number.isFinite(value))) {
    throw new Error("결정적 generatedAt 계산에 사용할 시각이 올바르지 않습니다.");
  }
  return new Date(Math.max(...timestamps)).toISOString();
}

export function assertStaticManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("manifest는 객체여야 합니다.");
  }
  if (manifest.schemaVersion !== 1) throw new Error("지원하지 않는 manifest schemaVersion입니다.");
  if (!/^static-[a-f0-9]{20}$/.test(manifest.contentVersion ?? "")) {
    throw new Error("manifest contentVersion 형식이 올바르지 않습니다.");
  }
  if (!Number.isFinite(Date.parse(manifest.generatedAt ?? ""))) {
    throw new Error("manifest generatedAt이 올바른 ISO 시각이 아닙니다.");
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.minimumAppVersion ?? "")) {
    throw new Error("manifest minimumAppVersion이 semver 형식이 아닙니다.");
  }
  for (const field of ["checksums", "sizes", "recordCounts"]) {
    if (!manifest[field] || typeof manifest[field] !== "object" || Array.isArray(manifest[field])) {
      throw new Error(`manifest ${field}가 객체가 아닙니다.`);
    }
  }
  for (const fileName of STATIC_DATA_FILES) {
    if (!/^[a-f0-9]{64}$/.test(manifest.checksums[fileName] ?? "")) {
      throw new Error(`${fileName} SHA-256이 올바르지 않습니다.`);
    }
    if (!Number.isInteger(manifest.sizes[fileName]) || manifest.sizes[fileName] < 1) {
      throw new Error(`${fileName} 크기가 올바르지 않습니다.`);
    }
    if (!Number.isInteger(manifest.recordCounts[fileName]) || manifest.recordCounts[fileName] < 0) {
      throw new Error(`${fileName} recordCount가 올바르지 않습니다.`);
    }
  }
  if (manifest.contentVersion !== contentVersionFor(manifest.checksums)) {
    throw new Error("manifest contentVersion이 checksums와 일치하지 않습니다.");
  }
  return manifest;
}
