import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {applyVerifiedRaceCorrections,correctionProblems,nativeCorrectionProblems} from './race-corrections.mjs';
import {normalizeRace} from './sync-mobile-races.mjs';
const registry=JSON.parse(readFileSync(new URL('../data/race-official-corrections.json',import.meta.url),'utf8'));
const jinju=registry.entries.find(c=>c.id==='schedule-221be78438dc');
const legacyRegistry={...registry,entries:registry.entries.filter(c=>c!==jinju)};
test('primary cancellation binds exact edition, survives renewed open directory values, and is idempotent',()=>{
 const data={featuredRaces:[],scheduleFeed:[{name:'Event',date:'2026-10-24',status:'open'},{name:'Event',date:'2027-10-24',status:'open'}]},c={entries:[{name:'Event',date:'2026-10-24',sourceUrl:'https://organizer.test/',patch:{status:'cancelled'}}]};
 assert.equal(applyVerifiedRaceCorrections(data,c),true);assert.equal(data.scheduleFeed[0].status,'cancelled');assert.equal(data.scheduleFeed[1].status,'open');assert.equal(applyVerifiedRaceCorrections(data,c),false);
 data.scheduleFeed[0].status='open';applyVerifiedRaceCorrections(data,c);assert.equal(data.scheduleFeed[0].status,'cancelled');
});
test('all four reviewed editions are protected without changing links/dates/IDs/observed timestamps',()=>{
 assert.equal(legacyRegistry.entries.length,4);
 const data={scheduleFeed:legacyRegistry.entries.map((c,i)=>({id:'race-'+i,name:c.name,date:c.date,status:'open',registrationUrl:'https://organizer.test/apply',sourceDetailUrl:'https://directory.test/event/'+i,dataVerifiedAt:'2026-10-01T00:00:00Z'}))};
 const before=data.scheduleFeed.map(({status,...row})=>({...row}));
 assert.ok(correctionProblems(data,legacyRegistry,'2026-10-22').length);applyVerifiedRaceCorrections(data,legacyRegistry);
 assert.deepEqual(correctionProblems(data,legacyRegistry,'2026-10-22'),[]);
 assert.deepEqual(data.scheduleFeed.map(r=>r.status),['unknown','cancelled','unknown','unknown']);
 data.scheduleFeed.forEach((row,i)=>{for(const field of ['id','date','registrationUrl','sourceDetailUrl','dataVerifiedAt'])assert.equal(row[field],before[i][field]);});
 assert.equal(data.scheduleFeed[0].registrationDataStatus,'needs-review');assert.equal(data.scheduleFeed[2].registrationDataStatus,'needs-review');
 const native=data.scheduleFeed.map(row=>normalizeRace(row,'schedule'));
 assert.deepEqual(nativeCorrectionProblems(native,legacyRegistry,'2026-10-22'),[]);
 native[0].registrationStatus='open';assert.ok(nativeCorrectionProblems(native,legacyRegistry,'2026-10-22').length);
});
test('missing future protected editions and unreviewed link/status patches fail closed',()=>{
 assert.equal(correctionProblems({scheduleFeed:[]},registry,'2026-10-22').length,registry.entries.length);
 for(const patch of [{status:'open'},{status:'cancelled',registrationUrl:'https://invented.test'}])assert.throws(()=>applyVerifiedRaceCorrections({scheduleFeed:[]},{entries:[{...registry.entries[0],patch}]}));
});

const jinjuRegistry=()=>({schemaVersion:1,entries:[structuredClone(jinju)]});
const jinjuRow=()=>({id:jinju.id,name:jinju.name,date:jinju.date,status:'scheduled',region:'경남',venue:'진주종합경기장',distances:['Full','Half','10K','5K'],registrationOpenAt:'2026-10-22T00:00:00+09:00',registrationOpenTimeConfirmed:false,registrationCloseAt:'2026-11-16T23:59:00+09:00',registrationCloseTimeConfirmed:true,registrationPeriodLabel:'10/22 - 11/16',registrationUrl:'https://organizer.test/apply',sourceDetailUrl:'https://directory.test/jinju',dataVerifiedAt:'2026-10-20T12:08:52.150Z',lastObservedAt:'2026-10-23T17:14:31.744Z',registrationTimeVerifiedAt:'2026-10-20T12:08:52.150Z'});
test('current registry protects its dynamic count while preserving the four legacy status regressions',()=>{
 assert.ok(jinju);assert.equal(registry.entries.length,legacyRegistry.entries.length+1);
 const data={scheduleFeed:registry.entries.map(c=>c===jinju?jinjuRow():{name:c.name,date:c.date,status:'open',dataVerifiedAt:'2026-10-01T00:00:00Z'})};
 assert.equal(correctionProblems({scheduleFeed:[]},registry,'2026-10-22').length,registry.entries.length);
 assert.equal(nativeCorrectionProblems([],registry,'2026-10-22').length,registry.entries.length);
 applyVerifiedRaceCorrections(data,registry);
 assert.deepEqual(correctionProblems(data,registry,'2026-10-22'),[]);
 assert.deepEqual(nativeCorrectionProblems(data.scheduleFeed.map(r=>normalizeRace(r,'schedule')),registry,'2026-10-22'),[]);
 assert.deepEqual(data.scheduleFeed.filter(r=>r.name!==jinju.name).map(r=>r.status),['unknown','cancelled','unknown','unknown']);
});
test('Jinju exact reviewed values remove fabricated close fields and preserve identities, links and observed dates',()=>{
 const row=jinjuRow(),before=structuredClone(row),data={scheduleFeed:[row]},c=jinjuRegistry();
 assert.equal(applyVerifiedRaceCorrections(data,c),true);
 for(const [key,value]of Object.entries(jinju.patch))assert.equal(row[key],value);
 for(const key of ['registrationCloseAt','registrationCloseTimeConfirmed'])assert.equal(Object.hasOwn(row,key),false);
 for(const key of ['id','name','date','distances','registrationUrl','sourceDetailUrl','dataVerifiedAt','lastObservedAt','registrationTimeVerifiedAt'])assert.deepEqual(row[key],before[key]);
 assert.equal(row.officialCorrectionSource,jinju.sourceUrl);assert.equal(Object.hasOwn(row,'checkedAt'),false);
 assert.deepEqual(correctionProblems(data,c,'2026-10-24'),[]);
 assert.equal(applyVerifiedRaceCorrections(data,c),false);
 row.registrationCloseAt=undefined;row.registrationCloseTimeConfirmed=false;
 assert.equal(correctionProblems(data,c,'2026-10-24').length,1);
 assert.equal(applyVerifiedRaceCorrections(data,c),true);
 assert.equal(Object.hasOwn(row,'registrationCloseAt'),false);assert.equal(Object.hasOwn(row,'registrationCloseTimeConfirmed'),false);
});
test('Jinju raw rows without IDs normalize to the existing ID; native opening fields and flags use the real mapping',()=>{
 const row=jinjuRow();delete row.id;const data={scheduleFeed:[row]},c=jinjuRegistry();applyVerifiedRaceCorrections(data,c);
 assert.equal(Object.hasOwn(row,'id'),false);const native=normalizeRace(row,'schedule');
 assert.equal(native.id,jinju.id);assert.equal(native.registrationOpensAt,jinju.patch.registrationOpenAt);assert.equal(native.registrationTimeConfirmed,true);assert.equal(native.registrationClosesAt,undefined);assert.equal(native.registrationClosingTimeConfirmed,undefined);
 assert.deepEqual(nativeCorrectionProblems([native],c,'2026-10-24'),[]);
 for(const id of [undefined,'other-event-id'])assert.equal(nativeCorrectionProblems([{...native,id}],c,'2026-10-24')[0].code,'missing-or-duplicate-protected-native-edition');
 for(const [field,value]of [['venue','진주종합경기장'],['registrationStatus','open'],['registrationOpensAt','2026-10-22T00:00:00+09:00'],['registrationTimeConfirmed',false],['registrationPeriodLabel','10/22 - 11/16'],['registrationClosesAt','2026-11-16T23:59:00+09:00']]){
  assert.equal(nativeCorrectionProblems([{...native,[field]:value}],c,'2026-10-24').length,1,field);
 }
});
test('native removal guard rejects surviving actual registrationClosingTimeConfirmed even when false',()=>{
 const row=jinjuRow(),c=jinjuRegistry();applyVerifiedRaceCorrections({scheduleFeed:[row]},c);const native=normalizeRace(row,'schedule');
 for(const value of [true,false,null])assert.equal(nativeCorrectionProblems([{...native,registrationClosingTimeConfirmed:value}],c,'2026-10-24').length,1);
 assert.deepEqual(nativeCorrectionProblems([native],c,'2026-10-24'),[]);
});
test('Jinju correction never inherits to a future edition, renamed event or mismatched existing ID',()=>{
 for(const change of [{date:'2027-12-13'},{name:'제37회 진주마라톤'},{id:'other-event-id'}]){
  const row={...jinjuRow(),...change},before=structuredClone(row);
  assert.equal(applyVerifiedRaceCorrections({scheduleFeed:[row]},jinjuRegistry()),false);assert.deepEqual(row,before);
 }
});
test('expanded Jinju fields and closed status cannot be used for an unreviewed edition',()=>{
 for(const change of [{date:'2027-12-13'},{name:'다른 대회'},{id:'another-id'}]){
  const c=jinjuRegistry();Object.assign(c.entries[0],change);assert.throws(()=>applyVerifiedRaceCorrections({scheduleFeed:[]},c));
 }
});
test('unreviewed Jinju patch values, unsupported keys and fabricated timestamps fail closed',()=>{
 for(const patch of [{...jinju.patch,status:'open'},{...jinju.patch,status:'sold_out'},{...jinju.patch,venue:'진주종합경기장'},{...jinju.patch,registrationOpenAt:'2026-10-22T00:00:00+09:00'},{...jinju.patch,registrationOpenTimeConfirmed:'true'},{...jinju.patch,registrationPeriodLabel:'10/22 - 11/16'},{...jinju.patch,registrationCloseAt:'2026-11-16T23:59:00+09:00'},{...jinju.patch,registrationUrl:'https://invented.test'},null,[]]){
  const c=jinjuRegistry();c.entries[0].patch=patch;assert.throws(()=>applyVerifiedRaceCorrections({scheduleFeed:[]},c));
 }
 const legacy=structuredClone(legacyRegistry);legacy.entries[0].patch.status='closed';assert.throws(()=>applyVerifiedRaceCorrections({scheduleFeed:[]},legacy));
});
test('removeFields is a strict reviewed-only two-field allowlist, not arbitrary deletion',()=>{
 for(const removeFields of [undefined,null,'registrationCloseAt',[],['registrationCloseAt'],['registrationCloseAt','registrationCloseAt'],['registrationCloseAt','registrationUrl'],['registrationCloseAt','registrationCloseTimeConfirmed','id'],['__proto__']]){
  const c=jinjuRegistry();c.entries[0].removeFields=removeFields;assert.throws(()=>applyVerifiedRaceCorrections({scheduleFeed:[]},c));
 }
 const legacy=structuredClone(legacyRegistry);legacy.entries[0].removeFields=['registrationCloseAt'];assert.throws(()=>applyVerifiedRaceCorrections({scheduleFeed:[]},legacy));
});
test('Jinju correction requires actual reviewed primary URL, response hash and checkedAt proofs',()=>{
 for(const change of [{sourceUrl:'https://directory.test/jinju'},{sourceSha256:'0'.repeat(64)},{checkedAt:'2026-10-25T00:00:00Z'},{primaryProof:[]}]){
  const c=jinjuRegistry();Object.assign(c.entries[0],change);assert.throws(()=>applyVerifiedRaceCorrections({scheduleFeed:[]},c));
 }
 const c=jinjuRegistry();c.entries[0].primaryProof[0].sha256='0'.repeat(64);assert.throws(()=>applyVerifiedRaceCorrections({scheduleFeed:[]},c));
});
test('collection applies reviewed patches between merge and health; publication validates raw AND native',()=>{
 const refresh=readFileSync(new URL('./refresh-races.mjs',import.meta.url),'utf8');
 const merged=refresh.indexOf('const merged = mergeMarathonGoDiscoveries'),apply=refresh.indexOf('if(applyVerifiedRaceCorrections(merged.data,corrections))');
 assert.ok(apply>merged&&apply<refresh.indexOf('const health = assessRaceRefreshHealth'));
 const publisher=readFileSync(new URL('./data-only-pages.mjs',import.meta.url),'utf8');
 assert.match(publisher,/correctionProblems\(raw,corrections,today\)/);assert.match(publisher,/nativeCorrectionProblems\(races.records,corrections,today\)/);
});
