import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {applyVerifiedRaceCorrections,correctionProblems,nativeCorrectionProblems} from './race-corrections.mjs';
import {normalizeRace} from './sync-mobile-races.mjs';
const registry=JSON.parse(readFileSync(new URL('../data/race-official-corrections.json',import.meta.url),'utf8'));
test('primary cancellation binds exact edition, survives renewed open directory values, and is idempotent',()=>{
 const data={featuredRaces:[],scheduleFeed:[{name:'Event',date:'2026-10-24',status:'open'},{name:'Event',date:'2027-10-24',status:'open'}]},c={entries:[{name:'Event',date:'2026-10-24',sourceUrl:'https://organizer.test/',patch:{status:'cancelled'}}]};
 assert.equal(applyVerifiedRaceCorrections(data,c),true);assert.equal(data.scheduleFeed[0].status,'cancelled');assert.equal(data.scheduleFeed[1].status,'open');assert.equal(applyVerifiedRaceCorrections(data,c),false);
 data.scheduleFeed[0].status='open';applyVerifiedRaceCorrections(data,c);assert.equal(data.scheduleFeed[0].status,'cancelled');
});
test('all four reviewed editions are protected without changing links/dates/IDs/observed timestamps',()=>{
 const data={scheduleFeed:registry.entries.map((c,i)=>({id:'race-'+i,name:c.name,date:c.date,status:'open',registrationUrl:'https://organizer.test/apply',sourceDetailUrl:'https://directory.test/event/'+i,dataVerifiedAt:'2026-10-01T00:00:00Z'}))};
 const before=data.scheduleFeed.map(({status,...row})=>({...row}));
 assert.ok(correctionProblems(data,registry,'2026-10-22').length);applyVerifiedRaceCorrections(data,registry);
 assert.deepEqual(correctionProblems(data,registry,'2026-10-22'),[]);
 assert.deepEqual(data.scheduleFeed.map(r=>r.status),['unknown','cancelled','unknown','unknown']);
 data.scheduleFeed.forEach((row,i)=>{for(const field of ['id','date','registrationUrl','sourceDetailUrl','dataVerifiedAt'])assert.equal(row[field],before[i][field]);});
 assert.equal(data.scheduleFeed[0].registrationDataStatus,'needs-review');assert.equal(data.scheduleFeed[2].registrationDataStatus,'needs-review');
 const native=data.scheduleFeed.map(row=>normalizeRace(row,'schedule'));
 assert.deepEqual(nativeCorrectionProblems(native,registry,'2026-10-22'),[]);
 native[0].registrationStatus='open';assert.ok(nativeCorrectionProblems(native,registry,'2026-10-22').length);
});
test('missing future protected editions and unreviewed link/status patches fail closed',()=>{
 assert.equal(correctionProblems({scheduleFeed:[]},registry,'2026-10-22').length,4);
 for(const patch of [{status:'open'},{status:'cancelled',registrationUrl:'https://invented.test'}])assert.throws(()=>applyVerifiedRaceCorrections({scheduleFeed:[]},{entries:[{...registry.entries[0],patch}]}));
});
test('collection applies reviewed patches between merge and health; publication validates raw AND native',()=>{
 const refresh=readFileSync(new URL('./refresh-races.mjs',import.meta.url),'utf8');
 const merged=refresh.indexOf('const merged = mergeMarathonGoDiscoveries'),apply=refresh.indexOf('if(applyVerifiedRaceCorrections(merged.data,corrections))');
 assert.ok(apply>merged&&apply<refresh.indexOf('const health = assessRaceRefreshHealth'));
 const publisher=readFileSync(new URL('./data-only-pages.mjs',import.meta.url),'utf8');
 assert.match(publisher,/correctionProblems\(raw,corrections,today\)/);assert.match(publisher,/nativeCorrectionProblems\(races.records,corrections,today\)/);
});
