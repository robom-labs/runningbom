(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.RunningBomRaceCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const KST_DATE_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });

  function normalizeRaceName(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/제\d+회/g, "")
      .replace(/\b20\d{2}\b/g, "")
      .replace(/marathon|race|trail|run/g, "")
      .replace(/마라톤대회|마라톤|트레일런|트레일|레이스/g, "")
      .replace(/[^0-9a-z가-힣]/g, "");
  }

  function raceIdentity(race) {
    return `${normalizeRaceName(race.name)}|${String(race.raceDate || race.date || "").slice(0, 10)}`;
  }

  function buildRaceCalendarEvents(race) {
    const events = [];
    const seen = new Set();
    const add = (type, at, label, targetKey) => {
      if (!at || Number.isNaN(Date.parse(at))) return;
      const key = `${type}|${at}|${targetKey || ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      events.push({ raceId: race.id, type, at, label, targetKey });
    };

    add("registration_open", race.registrationOpenAt, "접수 시작", "registration");
    for (const window of race.registrationWindows || []) {
      add("registration_open", window.opensAt, `${window.label} 접수 시작`, `window:${window.id || window.label}`);
    }
    add("registration_close", race.registrationCloseAt, "접수 마감");
    add("race_day", race.raceDate || race.date, "대회일");
    return events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  }

  function eventsForDate(races, dateKey) {
    return races.flatMap(buildRaceCalendarEvents).filter((event) => KST_DATE_KEY.format(new Date(event.at)) === dateKey);
  }

  function racesForDate(races, dateKey) {
    const ids = new Set(eventsForDate(races, dateKey).map((event) => event.raceId));
    return races.filter((race) => ids.has(race.id));
  }

  function eventCountsByDate(races) {
    const counts = new Map();
    for (const event of races.flatMap(buildRaceCalendarEvents)) {
      const key = KST_DATE_KEY.format(new Date(event.at));
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }

  return { normalizeRaceName, raceIdentity, buildRaceCalendarEvents, eventsForDate, racesForDate, eventCountsByDate };
});
