import test from 'node:test';import assert from 'node:assert/strict';
import {marathonGoRefreshTargets} from './race-data-core.mjs';
import {normalizeRace} from './mobile-race-core.mjs';
const url=id=>'https://marathongo.co.kr/raceDetail/domestic/'+id;
test('새 목록에서 빠진 기존 대회도 재확인하되 다른 호스트·지난 대회는 수집하지 않는다',()=>{
 const data={scheduleFeed:[{date:'2026-10-30',sourceDetailUrl:url('old')},{date:'2026-10-31',sourceDetailUrl:'https://marathongo.co.kr.evil.example/raceDetail/domestic/no'},{date:'2026-10-17',sourceDetailUrl:url('past')}]};
 assert.deepEqual(marathonGoRefreshTargets([url('new'),url('new')],data,{today:'2026-10-18'}),[url('new'),url('old')]);
});
test('내용 변경 시각과 성공적으로 다시 확인한 시각을 구분한다',()=>{
 const row={name:'대회',date:'2026-10-30',distances:['10K'],dataVerifiedAt:'2026-08-01T01:00:00Z',lastObservedAt:'2026-10-18T01:00:00Z'};
 assert.equal(normalizeRace(row,'qa').sourceCheckedAt,row.lastObservedAt);
 assert.equal(normalizeRace({...row,lastObservedAt:undefined},'qa').sourceCheckedAt,row.dataVerifiedAt);
});
