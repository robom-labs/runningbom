import test from 'node:test';
import assert from 'node:assert/strict';
import {safeRaceSource,selectRaceRefreshTargets,recordSuccessfulObservations,periodRevisitProblems,REQUIRED_PERIOD_REVISITS} from './race-refresh-targets.mjs';
import {normalizeRace} from './sync-mobile-races.mjs';
import {readFileSync} from 'node:fs';
const url = slug => 'https://marathongo.co.kr/raceDetail/domestic/' + slug;
test('strict source origin/path, canonical query stripping and no invented source', () => {
  assert.equal(safeRaceSource(url('abc') + '?utm_source=x#top'), url('abc'));
  for (const bad of ['http://marathongo.co.kr/raceDetail/domestic/a', url('a/b'), url('%2e%2e'), 'https://user@marathongo.co.kr/raceDetail/domestic/a', 'https://marathongo.co.kr:444/raceDetail/domestic/a', 'https://evil.test/raceDetail/domestic/a']) assert.equal(safeRaceSource(bad), null);
});
test('union future known and actual index, dedupe, missing/oldest first and absolute 180 cap', () => {
  const row = (slug, date, dataVerifiedAt) => ({sourceDetailUrl:url(slug),date,dataVerifiedAt});
  const data = {scheduleFeed:[row('old','2026-12-01','2026-01-01'),row('new','2026-12-01','2026-10-01'),row('missing','2026-12-01'),row('past','2025-01-01')]};
  const selected = selectRaceRefreshTargets([url('new'),url('index'),url('index')],data,{today:'2026-10-22'});
  assert.deepEqual(new Set(selected), new Set(['old','new','missing','index'].map(url)));
  assert.ok(selected.indexOf(url('missing')) < selected.indexOf(url('old'))); assert.ok(selected.indexOf(url('old')) < selected.indexOf(url('new')));
  assert.equal(selectRaceRefreshTargets(Array.from({length:200},(_,i)=>url('item-'+i)),{}, {today:'2026-10-22'}).length,180);
  assert.throws(()=>selectRaceRefreshTargets([],{}, {today:'2026-10-22',limit:181}));
});
test('freshness only after exact parsed source/edition/period; failure and mismatches retain LKG time', () => {
  const row={name:'A',date:'2026-12-01',sourceDetailUrl:url('a'),dataVerifiedAt:'2026-01-01',registrationOpenAt:'2026-10-01',registrationCloseAt:'2026-11-01'};
  for (const result of [{ok:false,url:url('a')},{ok:true,url:url('a'),race:{...row,date:'2027-12-01'}},{ok:true,url:url('a'),race:{...row,registrationCloseAt:'2026-11-02'}}]) {
    const data={scheduleFeed:[{...row}]}; assert.equal(recordSuccessfulObservations(data,[result],'2026-10-22T00:00:00Z'),false); assert.equal(data.scheduleFeed[0].lastObservedAt,undefined);
  }
  const data={scheduleFeed:[{...row}]};assert.equal(recordSuccessfulObservations(data,[{ok:true,url:url('a'),race:{...row}}],'2026-10-22T00:00:00Z'),true);
  assert.equal(data.scheduleFeed[0].dataVerifiedAt,row.dataVerifiedAt); assert.equal(normalizeRace(data.scheduleFeed[0],'schedule').sourceCheckedAt,'2026-10-22T00:00:00Z');
});
test('all six source attempts require explicit outcomes and a fresh audit', () => {
  const now=Date.parse('2026-10-22T00:00:00Z'), audit={checkedAt:new Date(now).toISOString(),targets:REQUIRED_PERIOD_REVISITS.map(url=>({url,outcome:'parsed'}))};
  assert.deepEqual(periodRevisitProblems(audit,now),[]);audit.targets[0].outcome='failed';assert.deepEqual(periodRevisitProblems(audit,now),[]);
  audit.targets.pop();assert.equal(periodRevisitProblems(audit,now).length,1);assert.ok(periodRevisitProblems(audit,now+37*3600000).length);
  assert.deepEqual(periodRevisitProblems({checkedAt:'2027-01-01T00:00:00Z',targets:[]},Date.parse('2027-01-01T00:00:00Z')),[]);
});
test('scheduled collector keeps bounded concurrency, timeout and rejection before source writes',()=>{
  const source=readFileSync(new URL('./refresh-races.mjs',import.meta.url),'utf8');
  assert.match(source,/const concurrency = 4/);assert.match(source,/const timeoutMs = 15_000/);
  assert.match(source,/safeRaceSource\(page.finalUrl\) !== url/);
  assert.ok(source.lastIndexOf('periodRevisitProblems(sourceRefreshAudit') < source.indexOf('writeFileSync(dataPath'));
});
