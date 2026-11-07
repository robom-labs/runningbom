import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm,rename,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {deflateSync} from 'node:zlib';
import {reconcileCourseSourceIndex,reconcileCourseMetadata,lifecycleInputs,lifecycleOutputs,losslessLegacyDivisions,finalizeCourseDiscoveryMembership} from './reconcile-course-source-index.mjs';
import {courseDigest,discoverRaceCourseSources,courseCandidate} from './course-discovery-core.mjs';
import {verifyCourseSourceIndex} from './course-source-index-core.mjs';
import {buildCourseCatalog} from './course-catalog-build.mjs';
import {approveDiscoveredImages} from './course-discovery-approval.mjs';
const now=Date.parse('2026-10-27T00:00:00Z'),checkedAt='2026-10-24T00:00:00Z';
const race={id:'r',name:'2026 Official Run',raceDate:'2026-11-15',distances:['5K'],officialUrl:'https://official.example/event'};
const bytes=races=>Buffer.from(JSON.stringify({revision:'public-fixture',races})+'\n');
function row(r=race){return{eventId:r.id,eventName:r.name,raceDate:r.raceDate,distanceKeys:r.distances,seedUrls:['https://official.example/event'],status:'verified-course-page',lastAttemptAt:checkedAt,approvedCourseIds:[],navigationFrontier:[],resolvedOfficialPages:[{url:'https://official.example/course',seedURL:'https://official.example/event',pageKind:'course',verified:true,title:'5K course',checkedAt,sha256:'a'.repeat(64),distanceLabels:['5K'],editionEvidence:{accepted:true,raceDate:r.raceDate,year:r.raceDate.slice(0,4)}}]};}
function index(races=[race]){return{schemaVersion:1,generatedAt:checkedAt,sourceSnapshotSha256:courseDigest(bytes(races)),sourceRecordCount:races.length,records:races.map(row)};}
const seeds={schemaVersion:1,sourceIndexSha256:'b'.repeat(64),records:[]};
test('retired past identities are archived; exact current bytes, retained evidence and idempotence bind',()=>{
 const retired={...race,id:'old',raceDate:'2026-10-24'},old=index([retired,race]),r=reconcileCourseSourceIndex(old,bytes([race]),{now});
 assert.equal(r.index.records.length,1);assert.deepEqual(r.index.records[0],old.records[1]);assert.deepEqual(r.index.lifecycleArchive[0].row,old.records[0]);assert.equal(r.index.generatedAt,old.generatedAt);assert.equal(r.index.sourceSnapshotSha256,courseDigest(bytes([race])));assert.equal(r.index.lifecycle.sourceReceiptTimestampsUnchanged,true);
 assert.equal(reconcileCourseSourceIndex(r.index,bytes([race]),{now}).changed,false);
 assert.throws(()=>verifyCourseSourceIndex(r.index,[race],{now,raceBytes:Buffer.from(bytes([race])+' ')}),/exact race-byte/);
 const rebound=reconcileCourseSourceIndex(r.index,Buffer.from(bytes([race])+' '),{now});assert.deepEqual(rebound.index.records,r.index.records);assert.equal(rebound.index.generatedAt,checkedAt);
});
test('new events are pending from literal declared safe official seeds, never receipts/approval/HTTP guesses',()=>{
 const extra={...race,id:'new',officialUrl:'http://official.example/http'},manifest={...seeds,records:[{eventId:'new',raceDate:extra.raceDate,urls:['https://new.example/declared']}]};
 const r=reconcileCourseSourceIndex(index(),bytes([race,extra]),{now,seedManifest:manifest}),pending=r.index.records[1];
 assert.deepEqual(pending.seedUrls,['https://new.example/declared']);assert.equal(pending.status,'pending-revalidation');assert.deepEqual(pending.resolvedOfficialPages,[]);assert.deepEqual(pending.approvedCourseIds,[]);assert.equal(pending.checkedAt,undefined);assert.equal(pending.lastAttemptAt,undefined);
 for(const officialUrl of ['https://marathongo.co.kr/race/1','https://user:password@official.example/','https://127.0.0.1/'])assert.deepEqual(reconcileCourseSourceIndex(index(),bytes([race,{...extra,officialUrl}]),{now}).index.records[1].seedUrls,[]);
 assert.throws(()=>reconcileCourseSourceIndex(index(),bytes([race,extra]),{now,seedManifest:{...manifest,records:[{...manifest.records[0],urls:['http://new.example/']}]}}),/Unsafe/);
});
test('new edition, changed name and new/removed division invalidate old approvals and retain archive clocks',()=>{
 for(const change of [{raceDate:'2027-11-15'},{name:'Renamed Run'},{distances:['5K','10K']},{distances:[]}]){
  const current={...race,...change},old=index(),r=reconcileCourseSourceIndex(old,bytes([current]),{now});
  assert.equal(r.index.records[0].status,'pending-revalidation');assert.deepEqual(r.index.records[0].resolvedOfficialPages,[]);assert.deepEqual(r.index.lifecycleArchive[0].row,old.records[0]);assert.equal(r.index.generatedAt,checkedAt);
 }
});
test('missing future identity, corrupt/future evidence and malformed race membership fail closed',()=>{
 assert.throws(()=>reconcileCourseSourceIndex(index([race,{...race,id:'future'}]),bytes([race]),{now}),/Missing current\/future/);
 assert.throws(()=>reconcileCourseSourceIndex(index(),bytes([race,race]),{now}),/Invalid exact/);
 const bad=index();bad.records[0].resolvedOfficialPages[0].checkedAt='2027-01-01T00:00:00Z';assert.throws(()=>reconcileCourseSourceIndex(bad,bytes([race]),{now}),/Unverified/);
 const mismatch=index();mismatch.sourceRecordCount=2;assert.throws(()=>reconcileCourseSourceIndex(mismatch,bytes([race]),{now}),/schema\/count/);
});
test('literal nonnumeric/new named divisions cannot hide behind the same parsed distance keys',()=>{
 const initial=reconcileCourseSourceIndex(index(),bytes([race]),{now}).index;
 const next={...race,distances:['5K','Kids Run']},r=reconcileCourseSourceIndex(initial,bytes([next]),{now});assert.equal(r.index.records[0].pendingReason,'disciplines-changed');
 assert.equal(reconcileCourseSourceIndex(r.index,bytes([next]),{now}).changed,false);
 const changed={...next,distances:['5K','Family Run']};assert.equal(reconcileCourseSourceIndex(r.index,bytes([changed]),{now}).index.records[0].pendingReason,'disciplines-changed');
});
test('P2-1: legacy numeric parsing cannot certify walk/family scope, mixed or duplicate-key divisions',()=>{
 for(const distances of [['5km 걷기'],['5km 가족'],['5K','5km 걷기'],['5K','5km 가족'],['5K/10K'],['5K','5km']]){
  const old=index();old.records[0].approvedCourseIds=['old-map'];const before=structuredClone(old),r=reconcileCourseSourceIndex(old,bytes([{...race,distances}]),{now}),p=r.index.records[0];
  assert.equal(p.status,'pending-revalidation');assert.deepEqual(p.resolvedOfficialPages,[]);assert.deepEqual(p.approvedCourseIds,[]);assert.deepEqual(r.index.lifecycleArchive[0].row,before.records[0]);assert.equal(r.index.generatedAt,checkedAt);assert.deepEqual(old,before);
  assert.equal(reconcileCourseSourceIndex(r.index,bytes([{...race,distances}]),{now}).changed,false);
 }
 for(const distances of [['5K'],['5km'],['5 km'],['5Ｋ']])assert.equal(losslessLegacyDivisions(distances,['5K']),true);
 assert.equal(losslessLegacyDivisions(['10K'],['5K']),false);assert.equal(losslessLegacyDivisions(['5K','10K'],['5K','10K']),true);
});
const oldMap={id:'old-map',eventId:race.id,eventName:race.name,raceDate:race.raceDate,distanceLabel:'5K',sourceKind:'official-image',segments:[],sourcePage:'https://official.example/course',sourceUrl:'https://official.example/map.png',imageUrl:'https://official.example/map.png',sourceSha256:'c'.repeat(64),checkedAt};
test('P2-2: actual offline discovery helper never reattaches historical IDs after name/date/division invalidation',async()=>{
 for(const change of [{distances:['10K']},{name:'Renamed Run'},{raceDate:'2027-11-15'},{distances:['5km 걷기']},{distances:['5K','5km 가족']}]){
  const old=index();old.records[0].approvedCourseIds=[oldMap.id];const current={...race,...change},reconciled=reconcileCourseSourceIndex(old,bytes([current]),{now}).index;
  const observed=await discoverRaceCourseSources(current,{seeds:[{url:race.officialUrl}],now,get:async()=>({ok:false,reason:'offline-no-current-proof'})});
  const historical=[structuredClone(oldMap)],before=structuredClone(historical),result=finalizeCourseDiscoveryMembership(reconciled,[observed],[current],{approvedImages:historical,now,acceptImages:true});
  assert.deepEqual(result.records[0].approvedCourseIds,[]);assert.equal(result.records[0].pendingReason,reconciled.records[0].pendingReason);assert.deepEqual(result.approval.approved,before);assert.deepEqual(historical,before);
  const next={...reconciled,records:result.records};const again=finalizeCourseDiscoveryMembership(next,[observed],[current],{approvedImages:historical,now});assert.deepEqual(again.records[0].approvedCourseIds,[]);
 }
});
test('current membership retains reconciled plain IDs but regains invalidated IDs only with qualified current source',()=>{
 const old=index();old.records[0].approvedCourseIds=[oldMap.id];const good=reconcileCourseSourceIndex(old,bytes([race]),{now}).index;
 const noProof={...row(),resolvedOfficialPages:[],candidates:[]};assert.deepEqual(finalizeCourseDiscoveryMembership(good,[noProof],[race],{approvedImages:[oldMap],now}).records[0].approvedCourseIds,[oldMap.id]);
 const current={...race,name:'Renamed Run'},pending=reconcileCourseSourceIndex(good,bytes([current]),{now}).index;
 const proof={...row(current).resolvedOfficialPages[0],pageKind:'course',publishedDistanceKm:{}},receipt={checkedAt,sha256:oldMap.sourceSha256,finalUrl:oldMap.imageUrl,body:Buffer.alloc(100),contentType:'image/png'},asset={kind:'image',url:oldMap.sourceUrl,distanceKeys:['5K'],distanceEvidence:'explicit-asset-caption-or-filename',explicitCourseDeclaration:true};
 const candidates=courseCandidate(current,asset,receipt,proof,{kind:'official-image',width:400,height:200}),observation={...row(current),candidates};
 const fresh=finalizeCourseDiscoveryMembership(pending,[observation],[current],{approvedImages:[oldMap],now});assert.deepEqual(fresh.records[0].approvedCourseIds,[oldMap.id]);assert.equal(fresh.records[0].pendingReason,undefined);
 const broken=structuredClone(observation);broken.candidates[0].discoveryEvidence.validatedRaster=null;assert.deepEqual(finalizeCourseDiscoveryMembership(pending,[broken],[current],{approvedImages:[oldMap],now}).records[0].approvedCourseIds,[]);
 const walking={...current,distances:['5km 걷기']};const blocked=finalizeCourseDiscoveryMembership(pending,[observation],[walking],{approvedImages:[oldMap],acceptImages:true,now});assert.deepEqual(blocked.records[0].approvedCourseIds,[]);assert.equal(blocked.approval.accepted.length,0);assert.equal(blocked.scopeQuarantine.length,1);
});
test('production discovery CLI delegates approval and coverage to the current-membership helper, not event/date reattachment',async()=>{
 const source=await readFile(new URL('./course-discover-sources.mjs',import.meta.url),'utf8');assert.match(source,/finalizeCourseDiscoveryMembership\(currentPrevious,rows,races/);assert.doesNotMatch(source,/row\.approvedCourseIds=allApproved\.filter/);assert.match(source,/const approval=membership\.approval/);assert.match(source,/records\.filter\(r=>r\.approvedCourseIds\.length\)/);
});
function sourcePNG(){
 const crc=b=>{let c=0xffffffff;for(const n of b){c^=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return(c^0xffffffff)>>>0;};
 const chunk=(kind,b)=>{const k=Buffer.from(kind),n=Buffer.alloc(4),c=Buffer.alloc(4);n.writeUInt32BE(b.length);c.writeUInt32BE(crc(Buffer.concat([k,b])));return Buffer.concat([n,k,b,c]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(400);header.writeUInt32BE(200,4);header[8]=8;header[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.alloc((400*3+1)*200))),chunk('IEND',Buffer.alloc(0))]);
}
async function literalSourceDiscovery(current,captions){
 const image=sourcePNG(),html=`<title>${current.name} 코스 안내</title><h1>${current.name}</h1><p>대회일 ${current.raceDate.replaceAll('-','.')} 공식 일정</p>`+captions.map(([literal,file])=>`<section><h2>${literal}</h2><img alt="${literal} 코스도" src="/${file}.png"></section>`).join('');
 const get=async url=>{const body=url===current.officialUrl?Buffer.from(html):image;return{ok:true,requestedUrl:url,finalUrl:url,body,text:url===current.officialUrl?html:'',sha256:courseDigest(body),sourceRepresentation:url===current.officialUrl?'raw-html':'binary',contentType:url===current.officialUrl?'text/html':'image/png',checkedAt,verification:'offline-source-fixture'};};
 return discoverRaceCourseSources(current,{seeds:[{url:current.officialUrl}],get,now});
}
test('fresh exact official named walk and plain10K sibling both qualify per option in a mixed race; nonnumeric names have a proof path',async()=>{
 const current={...race,distances:['５km   걷기','10K','가족코스']},pending=reconcileCourseSourceIndex(index(),bytes([current]),{now}).index;
 const observed=await literalSourceDiscovery(current,[['5km 걷기','walk'],['10K','ten'],['가족코스','family']]);
 assert.deepEqual(observed.candidates.map(c=>c.distanceLabel),['5km 걷기','10K','가족코스'],JSON.stringify({issues:observed.issues,pages:observed.observations}));
 const result=finalizeCourseDiscoveryMembership(pending,[observed],[current],{acceptImages:true,now});assert.equal(result.approval.accepted.length,3);assert.equal(result.approval.quarantine.length,0);assert.equal(result.records[0].approvedCourseIds.length,3);
 const walk=result.approval.approved.find(c=>c.distanceLabel==='5km 걷기'),family=result.approval.approved.find(c=>c.distanceLabel==='가족코스');assert.equal(walk.discoveryEvidence.disciplineScope.literal,'5km 걷기');assert.equal(walk.discoveryEvidence.pageSha256,observed.resolvedOfficialPages[0].sha256);assert.equal(family.officialDistanceKm,undefined);
 const built=buildCourseCatalog({courses:result.approval.approved,elevation:{schemaVersion:1,profiles:[]},index:{...pending,records:result.records},races:[current],raceBytes:bytes([current]),now});assert.deepEqual(built.catalog.pages[0].distanceLabels,['5km 걷기','10K','가족코스']);
 const bound={...pending,records:result.records},failed={...observed,candidates:[],resolvedOfficialPages:[]};const retained=finalizeCourseDiscoveryMembership(bound,[failed],[current],{approvedImages:result.approval.approved,now});assert.deepEqual(retained.records[0].approvedCourseIds,result.records[0].approvedCourseIds);assert.deepEqual(retained.approval.approved,result.approval.approved);
});
test('generic5K, wrong named scope, absent receipt witness and tampered literal never qualify walk/family',async()=>{
 const current={...race,distances:['5km 걷기','10K']},pending=reconcileCourseSourceIndex(index(),bytes([current]),{now}).index;
 for(const caption of ['5K','5km 가족']){const observed=await literalSourceDiscovery(current,[[caption,'unknown'],['10K','ten']]),r=finalizeCourseDiscoveryMembership(pending,[observed],[current],{acceptImages:true,now});assert.deepEqual(r.approval.approved.map(c=>c.distanceLabel),['10K']);assert.equal(r.records[0].approvedCourseIds.length,1);}
 const observed=await literalSourceDiscovery(current,[['5km 걷기','walk']]);
 for(const change of [o=>delete o.candidates[0].discoveryEvidence.disciplineScope,o=>o.candidates[0].discoveryEvidence.disciplineScope.literal='5km 가족',o=>o.resolvedOfficialPages[0].disciplineDeclarations=[],o=>o.candidates[0].discoveryEvidence.disciplineScope.pageSha256='b'.repeat(64),o=>o.candidates[0].discoveryEvidence.disciplineScope.assetSha256='b'.repeat(64),o=>o.candidates[0].sourceUrl='https://official.example/other.png',o=>o.candidates[0].discoveryEvidence.disciplineScope.sourceRepresentation='rendered-dom']){const changed=structuredClone(observed);change(changed);const r=finalizeCourseDiscoveryMembership(pending,[changed],[current],{acceptImages:true,now});assert.equal(r.approval.accepted.length,0);assert.deepEqual(r.records[0].approvedCourseIds,[]);}
 const noWitness=approveDiscoveredImages([],observed.candidates,[current],{now});assert.equal(noWitness.accepted.length,0);assert.equal(noWitness.quarantine[0].reason,'official-literal-discipline-proof-required');
});
test('same numeric distance never collapses run/walk/family options, while plain sibling eligibility is independent',async()=>{
 const current={...race,distances:['5K','5km 걷기','5km 가족','10K']},pending=reconcileCourseSourceIndex(index(),bytes([current]),{now}).index;
 const observed=await literalSourceDiscovery(current,[['5K','run'],['5km 걷기','walk'],['5km 가족','family'],['10K','ten']]);
 const r=finalizeCourseDiscoveryMembership(pending,[observed],[current],{acceptImages:true,now});assert.equal(r.approval.approved.length,4);assert.equal(new Set(r.records[0].approvedCourseIds).size,4);assert.deepEqual(r.approval.approved.map(c=>c.distanceLabel),current.distances);
 const generic=await literalSourceDiscovery(current,[['5K','run']]),onlyRun=finalizeCourseDiscoveryMembership(pending,[generic],[current],{acceptImages:true,now});assert.deepEqual(onlyRun.approval.approved.map(c=>c.distanceLabel),['5K']);
 for(const label of ['5km 걷기','5km 가족']){const namedOnly={...race,distances:[label,'10K']},blocked=await literalSourceDiscovery(namedOnly,[['5K','generic']]);assert.equal(finalizeCourseDiscoveryMembership(reconcileCourseSourceIndex(index(),bytes([namedOnly]),{now}).index,[blocked],[namedOnly],{acceptImages:true,now}).approval.accepted.length,0);}
});
test('successive scheduled pruning and next-edition arrival reconcile again, not a one-off 90-row repair',()=>{
 const firstPast={...race,id:'first-past',raceDate:'2026-10-24'},start=index([firstPast,race]);
 const first=reconcileCourseSourceIndex(start,bytes([race]),{now}).index;
 const next={...race,id:'next-edition',raceDate:'2027-11-15'},nextBytes=bytes([next]);
 const second=reconcileCourseSourceIndex(first,nextBytes,{now:Date.parse('2026-11-16T00:00:00Z')}).index;
 assert.equal(second.records.length,1);assert.equal(second.records[0].eventId,next.id);assert.equal(second.records[0].pendingReason,'new-event');assert.equal(second.lifecycleArchive.length,2);assert.equal(second.sourceSnapshotSha256,courseDigest(nextBytes));assert.equal(second.generatedAt,checkedAt);
});
test('expired evidence becomes pending with original immutable archive, not a refreshed approval',()=>{
 const old=index();old.records[0].resolvedOfficialPages[0].checkedAt='2026-09-01T00:00:00Z';const r=reconcileCourseSourceIndex(old,bytes([race]),{now});assert.equal(r.index.records[0].pendingReason,'source-evidence-expired');assert.equal(r.index.lifecycleArchive[0].row.resolvedOfficialPages[0].checkedAt,'2026-09-01T00:00:00Z');assert.equal(r.index.generatedAt,checkedAt);
});
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'public-index-lifecycle-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const retired={...race,id:'retired',raceDate:'2026-10-24'},old=index([retired,race]),races=[retired,race],course={id:'image',eventId:'r',raceDate:race.raceDate,distanceLabel:'5K',sourceKind:'official-image',segments:[],sourceUrl:'https://official.example/map.png',imageUrl:'https://official.example/map.png',checkedAt},elevation={schemaVersion:1,profiles:[]};
 const built=buildCourseCatalog({courses:[course],elevation,index:old,races,raceBytes:bytes(races),now});
 const values={'apps/mobile/src/data/races.json':bytes([race]),'data/course-source-index.json':old,'data/course-source-seeds.json':seeds,'data/course-base.json':[],'data/course-approved-images.json':[course],'data/course-elevation.json':elevation,'data/course-catalog.json':built.text,'data/course-catalog.manifest.json':built.manifestText};
 for(const [p,v]of Object.entries(values)){await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),Buffer.isBuffer(v)||typeof v==='string'?v:JSON.stringify(v));}
 const capture=async()=>Object.fromEntries(await Promise.all(lifecycleInputs.map(async p=>[p,await readFile(join(root,p),'utf8')])));
 return{root,capture};
}
test('all outputs are validated then CAS applied; repeat is unchanged and course/elevation bytes preserved',async t=>{
 const f=await fixture(t),before=await f.capture(),r=await reconcileCourseMetadata(f.root,{write:true,now});assert.equal(r.state,'APPLIED_LOCAL_METADATA');assert.equal(r.recordCount,1);const after=await f.capture();for(const p of lifecycleInputs.filter(p=>!lifecycleOutputs.includes(p)))assert.equal(after[p],before[p]);
 assert.equal((await reconcileCourseMetadata(f.root,{write:true,now})).state,'UNCHANGED');await reconcileCourseMetadata(f.root,{now});
});
test('check-only drift and validation failure leave last-good outputs byte-identical',async t=>{
 const f=await fixture(t),before=await f.capture();await assert.rejects(reconcileCourseMetadata(f.root,{now}),/lifecycle drift/);assert.deepEqual(await f.capture(),before);
 const broken=JSON.parse(before['data/course-source-index.json']);broken.records[0].raceDate='2027-01-01';await writeFile(join(f.root,'data/course-source-index.json'),JSON.stringify(broken));const bad=await f.capture();await assert.rejects(reconcileCourseMetadata(f.root,{write:true,now}));assert.deepEqual(await f.capture(),bad);assert(!(await readdir(join(f.root,'data'))).some(p=>p.includes('.lifecycle-')||p.endsWith('.lock')));
});
test('race/seed/input drift after staging refuses writes and preserves concurrent input, with no blind retry',async t=>{
 for(const path of ['apps/mobile/src/data/races.json','data/course-source-seeds.json','data/course-catalog.json']){
  const f=await fixture(t),before=await f.capture(),drift=before[path]+' ';
  await assert.rejects(reconcileCourseMetadata(f.root,{write:true,now,beforeApply:()=>writeFile(join(f.root,path),drift)}),/Concurrent/);
  const after=await f.capture();for(const p of lifecycleInputs)assert.equal(after[p],p===path?drift:before[p]);
 }
});
test('failure after first rename restores only owned candidate bytes and leaves last good intact',async t=>{
 const f=await fixture(t),before=await f.capture();let n=0;
 await assert.rejects(reconcileCourseMetadata(f.root,{write:true,now,renameFile:async(a,b)=>{if(++n===2)throw Error('simulated write failure');await rename(a,b);}}),/simulated/);assert.deepEqual(await f.capture(),before);
 await new Promise(r=>setTimeout(r,5));assert.deepEqual(await f.capture(),before);
});
test('post-write concurrent ownership is never rolled back over a newer writer',async t=>{
 const f=await fixture(t);let n=0;const newer='{"newerWriter":true}\n';
 await assert.rejects(reconcileCourseMetadata(f.root,{write:true,now,renameFile:async(a,b)=>{if(++n===2){await writeFile(join(f.root,lifecycleOutputs[0]),newer);throw Error('concurrent writer');}await rename(a,b);}}),e=>e.lifecycleReport.state==='PARTIAL_REQUIRES_RECONCILIATION');
 assert.equal(await readFile(join(f.root,lifecycleOutputs[0]),'utf8'),newer);
});
test('race and metadata schedules reconcile before validation/publication; no full-site/OTA path added',async()=>{
 const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8'),raceJob=await read('.github/workflows/refresh-race-data.yml'),courseJob=await read('.github/workflows/refresh-course-catalog.yml'),pages=await read('.github/workflows/pages.yml');
 assert(raceJob.indexOf('npm run mobile:sync')<raceJob.indexOf('reconcile-course-source-index.mjs --write'));assert(raceJob.indexOf('reconcile-course-source-index.mjs --write')<raceJob.indexOf('node scripts/validate-static.mjs'));
 assert(courseJob.indexOf('reconcile-course-source-index.mjs --write')<courseJob.indexOf('--ci-staging --without-audit --live'));
 assert.match(raceJob,/git rev-parse origin\/main/);assert.match(raceJob,/gh workflow run data-only-pages.yml/);assert.match(pages,/if: github.event_name == 'workflow_dispatch' && inputs.publish_app_web == true/);
 for(const workflow of [raceJob,courseJob])assert.doesNotMatch(workflow,/gh workflow run (?:pages|preview-ota|play-release)\.yml|expo (?:publish|export)|eas (?:update|build)/);
});
