// Bounded, same-origin rotation of actual index links and already-known future sources.
export function safeRaceSource(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'marathongo.co.kr' || url.port || url.username || url.password
      || !/^\/raceDetail\/domestic\/[a-zA-Z0-9_-]+$/.test(url.pathname)) return null;
    return url.origin + url.pathname;
  } catch { return null; }
}
export const REQUIRED_PERIOD_REVISITS = Object.freeze([
  '2026-taejongdae-beat-on-zombie-race', '2026-jeon-guk-sasang-eco-marathon',
  '2026-cheongyang-gun-chilgab-marathon', '2026-incheon-marathon-asiad-stadium-start',
  'mokyokrun-2026-nov28', '2026-hanam-misa-lake-energy-run',
].map(slug => 'https://marathongo.co.kr/raceDetail/domestic/' + slug));
export function selectRaceRefreshTargets(indexUrls, data, {today, limit = 180} = {}) {
  if (!today || !Number.isInteger(limit) || limit < 1 || limit > 180) throw Error('invalid bounded refresh selection');
  const targets = new Map();
  for (const row of [...(data.featuredRaces || []), ...(data.scheduleFeed || [])]) {
    if (String(row.raceDate ?? row.date).slice(0, 10) < today) continue;
    const url = safeRaceSource(row.sourceDetailUrl); if (!url) continue;
    const checked = Date.parse(row.lastObservedAt || row.dataVerifiedAt || '');
    const age = Number.isFinite(checked) ? checked : 0;
    targets.set(url, Math.min(targets.get(url) ?? Infinity, age));
  }
  for (const value of indexUrls) { const url = safeRaceSource(value); if (url && !targets.has(url)) targets.set(url, 0); }
  return [...targets].sort(([a, ageA], [b, ageB]) => ageA - ageB || a.localeCompare(b)).slice(0, limit).map(([url]) => url);
}
// An HTTP response alone is not observation acceptance. Match parsed edition and period too.
export function recordSuccessfulObservations(data, results, checkedAt) {
  let changed = false;
  for (const row of data.scheduleFeed || []) {
    const source = safeRaceSource(row.sourceDetailUrl);
    const result = results.find(r => r.ok && safeRaceSource(r.url) === source
      && safeRaceSource(r.race.sourceDetailUrl) === source
      && r.race.date === row.date
      && r.race.registrationOpenAt === row.registrationOpenAt
      && r.race.registrationCloseAt === row.registrationCloseAt);
    if (source && result && row.lastObservedAt !== checkedAt) { row.lastObservedAt = checkedAt; changed = true; }
  }
  return changed;
}
export function periodRevisitProblems(audit, now = Date.now()) {
  if (!audit || !Number.isFinite(Date.parse(audit.checkedAt)) || now - Date.parse(audit.checkedAt) > 36 * 3600000
    || Date.parse(audit.checkedAt) > now + 300000) return ['missing-or-stale-revisit-audit'];
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(now));
  const editions = ['2026-10-31','2026-11-08','2026-11-08','2026-11-22','2026-11-28','2026-12-05'];
  return REQUIRED_PERIOD_REVISITS.filter((url,index) => editions[index] >= today
    && !audit.targets?.some(r => r.url === url && ['parsed', 'failed'].includes(r.outcome)));
}
