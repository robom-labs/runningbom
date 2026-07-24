// 외부 대회 링크를 HTTPS 전용으로 정리하는 순수 변환 규칙을 제공한다.

export const SECURE_LINK_FIELDS = ["registrationUrl", "sourceDetailUrl"];

function verifiedHttpsUrl(result) {
  if (!result?.usable || typeof result.finalUrl !== "string") return null;
  try {
    const url = new URL(result.finalUrl);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// HTTP 주소는 실측한 HTTPS 최종 주소로만 교체한다. TLS 연결을 확인하지 못한 주소는
// 사용자에게 노출하지 않으며, 대회 자체와 날짜·알림 데이터는 그대로 보존한다.
export function applyHttpsAudit(data, auditResults) {
  const byRawUrl = new Map(
    (Array.isArray(auditResults) ? auditResults : [])
      .filter((result) => typeof result?.raw === "string")
      .map((result) => [result.raw, result]),
  );
  const summary = { upgraded: 0, removed: 0, untouched: 0 };

  const sanitizeRows = (rows) => (Array.isArray(rows) ? rows : []).map((race) => {
    let next = race;
    for (const field of SECURE_LINK_FIELDS) {
      const raw = race?.[field];
      if (typeof raw !== "string" || !raw.startsWith("http://")) continue;
      if (next === race) next = { ...race };
      const secureUrl = verifiedHttpsUrl(byRawUrl.get(raw));
      if (secureUrl) {
        next[field] = secureUrl;
        summary.upgraded += 1;
      } else {
        delete next[field];
        summary.removed += 1;
      }
    }
    if (next === race) summary.untouched += 1;
    return next;
  });

  return {
    data: {
      ...data,
      featuredRaces: sanitizeRows(data?.featuredRaces),
      scheduleFeed: sanitizeRows(data?.scheduleFeed),
    },
    summary,
  };
}
