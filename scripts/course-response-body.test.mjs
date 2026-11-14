import test from 'node:test';import assert from 'node:assert/strict';
import {decodeCourseReceipt} from './course-response-body.mjs';
import {courseDigest,discoverRaceCourseSources,mergeCourseDiscoveryIndex,coursePagePublicationKind} from './course-discovery-core.mjs';
import {courseCatalogPages,verifyCourseSourceIndex} from './course-source-index-core.mjs';
import {createCourseSourceRetriever} from './course-discovery-fetch.mjs';
const origin='https://official.example/course',at='2026-10-26T00:00:00Z',later='2026-10-27T00:00:00Z',now=Date.parse(later)+60000;
const race={id:'public-fixture',name:'2027 Official Race',raceDate:'2027-03-21',distances:['10K']};
const shell=content=>'<title>2027 Official Race course</title><h1>2027 Official Race</h1><p>Event date : 2027.03.21 event</p>'+content;
const childDocument=extra=>'<html><head><title>2027 Official Race course</title>'+(extra.startsWith('<meta')?extra:'')+'</head><body><h1>2027 Official Race</h1>'+(!extra.startsWith('<meta')?extra:'')+'<img alt="10K course map" src="/map.png"></body></html>';
const published=shell('<img alt="10K course map" src="/map.png">'),pending=shell('<p>Course map coming soon</p>');
const receipt=(body,{contentType='text/html;charset=UTF-8',checkedAt=at,text='UNBOUND'}={})=>({ok:true,requestedUrl:origin,finalUrl:origin,body:Buffer.from(body),sha256:courseDigest(body),contentType,checkedAt,text});
const observe=r=>discoverRaceCourseSources(race,{seeds:[{url:origin}],get:async()=>r,maxAssets:0,now});
const index=row=>({schemaVersion:1,sourceRecordCount:1,sourceSnapshotSha256:'a'.repeat(64),records:[row]});
test('body digest, not independently supplied text, binds decoder output',()=>{
 const r=receipt(pending,{text:published}),decoded=decodeCourseReceipt(r);assert.equal(decoded.text,pending);assert.equal(decoded.sourceSha256,r.sha256);assert.equal(decoded.sourceBytes,r.body.length);assert.equal(r.text,published);assert.equal(decoded.from,'hash-verified-body');
});
test('corrupt, oversized, empty and non-byte bodies cannot create decoded claims',()=>{
 for(const r of [{...receipt(pending),sha256:'0'.repeat(64)},{...receipt(pending),body:pending},receipt(Buffer.alloc(0))])assert.throws(()=>decodeCourseReceipt(r),/integrity/);
 assert.throws(()=>decodeCourseReceipt(receipt(pending),{maxBytes:3}),/integrity/);
});
test('unsupported and conflicting declared charsets fail instead of UTF8 fallback',()=>{
 assert.throws(()=>decodeCourseReceipt(receipt(pending,{contentType:'text/html;charset=not-a-real-charset'})),/unsupported/);
 assert.throws(()=>decodeCourseReceipt(receipt('<meta charset="euc-kr">'+pending)),/conflicting/);
});
test('invalid UTF8 bytes fail fatal decoding rather than acquiring replacement characters',()=>{
 assert.throws(()=>decodeCourseReceipt(receipt(Buffer.from([0xc3,0x28]))),/invalid-course-page-encoding/);
});
const korean=Buffer.from('c4dabdbab5b520c3dfc8c420b0f8b0b320bfb9c1a4','hex'); // EUC-KR: 코스도 추후 공개 예정
test('explicit EUC-KR header and quoted aliases preserve actual Korean bytes and original digest',()=>{
 const r=receipt(korean,{contentType:'text/html; charset="EUC-KR"'}),d=decodeCourseReceipt(r);assert.equal(d.text,'코스도 추후 공개 예정');assert.equal(d.encoding,'euc-kr');assert.equal(d.sourceSha256,courseDigest(korean));assert.notEqual(d.sourceSha256,courseDigest(d.text));
});
test('a real HTML meta charset, not a script/comment string or receipt.text, may declare EUC-KR',()=>{
 const body=Buffer.concat([Buffer.from('<html><head><meta charset="euc-kr"></head><body><p>'),korean,Buffer.from('</p></body></html>')]);
 const d=decodeCourseReceipt(receipt(body,{contentType:'text/html'}));assert.match(d.text,/코스도 추후 공개 예정/);assert.equal(d.encoding,'euc-kr');
 const fake='<!--<meta charset="euc-kr">--><script>"<meta charset=euc-kr>"</script>'+pending;assert.equal(decodeCourseReceipt(receipt(fake)).encoding,'utf-8');
});
test('UTF8 and explicit UTF16 BOMs bind supported decoding and cannot silently contradict headers',()=>{
 assert.equal(decodeCourseReceipt(receipt(Buffer.concat([Buffer.from([239,187,191]),Buffer.from(pending)]))).text,pending);
 const b=Buffer.concat([Buffer.from([255,254]),Buffer.from(pending,'utf16le')]);assert.equal(decodeCourseReceipt(receipt(b,{contentType:'text/html;charset=utf-16le'})).text,pending);
 assert.throws(()=>decodeCourseReceipt(receipt(b)),/conflicting/);
});
test('body-bound EUC-KR publication classification does not trust a lying decoded text field',async()=>{
 const body=Buffer.concat([Buffer.from(shell('<p>')),korean,Buffer.from('</p>')]),r=receipt(body,{contentType:'text/html;charset=euc-kr',text:published}),row=await observe(r),p=row.resolvedOfficialPages[0];
 assert.equal(p.pageKind,'event');assert.equal(p.courseContentStatus,'unpublished');assert.equal(p.bodyDecode.encoding,'euc-kr');assert.equal(p.sha256,courseDigest(body));assert.equal(p.checkedAt,at);assert.equal(p.courseContentEvidence.sourceSha256,p.sha256);
});
test('unknown heading-only source is a navigation hint, not newly completed course coverage',async()=>{
 const row=await observe(receipt(shell('<h2>Course information</h2>'))),p=row.resolvedOfficialPages[0];assert.equal(p.pageKind,'course');assert.equal(p.courseContentStatus,'unknown');assert.equal(coursePagePublicationKind(p),'event');assert.equal(row.status,'verified-event-page');assert.equal(verifyCourseSourceIndex(index(row),[race],{now}).coursePages,0);assert.equal(courseCatalogPages(index(row),[race],{now})[0].kind,'event');
});
test('unbound stored classification or a held page claiming course completion is rejected',async()=>{
 const row=await observe(receipt(pending)),bad=structuredClone(row);bad.resolvedOfficialPages[0].courseContentEvidence.sourceSha256='b'.repeat(64);assert.throws(()=>courseCatalogPages(index(bad),[race],{now}),/Unbound/);
 const inconsistent=structuredClone(row);inconsistent.resolvedOfficialPages[0].pageKind='course';assert.throws(()=>courseCatalogPages(index(inconsistent),[race],{now}),/Unpublished/);
});
test('failed decoding cannot demote a last-good proof or change any original receipt clock',async()=>{
 const old=await observe(receipt(published)),before=JSON.stringify(old),next=await observe(receipt(Buffer.from([255]),{checkedAt:later})),merged=mergeCourseDiscoveryIndex({records:[old]},[next],[race])[0];assert.equal(merged.resolvedOfficialPages[0].sha256,courseDigest(published));assert.equal(merged.resolvedOfficialPages[0].checkedAt,at);assert.equal(JSON.stringify(old),before);
});
test('same-clock different-body conflicts do not undo the last successful publication state',async()=>{
 const old=await observe(receipt(published)),different=await observe(receipt(pending)),merged=mergeCourseDiscoveryIndex({records:[old]},[different],[race])[0];assert.equal(merged.resolvedOfficialPages[0].sha256,old.resolvedOfficialPages[0].sha256);assert.equal(merged.resolvedOfficialPages[0].courseContentStatus,'published');
});
test('cached unbound text cannot add a wrapper redirect or replace a public source body',async()=>{
 const r=receipt(published,{text:'<meta http-equiv="refresh" content="0;url=/unbound">'}),cache=new Map([[origin,r]]),client=createCourseSourceRetriever({cache,now:()=>Date.parse(at),requestImpl:async()=>{throw Error('no network');}}),got=await client.get(origin);
 assert.equal(got.text,published);assert.equal(got.checkedAt,at);assert.equal(r.text.includes('/unbound'),true);assert.equal(client.stats().newRequests,0);
});
test('text-only cached legacy receipt has no body/hash authority',async()=>{
 const client=createCourseSourceRetriever({cache:new Map([[origin,{ok:true,text:published,checkedAt:at}]]),now:()=>Date.parse(at)}),r=await client.get(origin);assert.equal(r.ok,false);assert.match(r.reason,/integrity/);assert.equal(client.stats().newRequests,0);
});
test('a same-origin parent cannot lend its date over an explicit conflicting child body date',async()=>{
 const home='https://official.example/',root=shell('<a href="/course">course map</a>'),old=await discoverRaceCourseSources(race,{seeds:[{url:home}],now,maxAssets:0,get:async url=>({...receipt(url===home?root:published),requestedUrl:url,finalUrl:url})});
 const wrong=pending.replaceAll('2027.03.21','2027.03.22'),next=await discoverRaceCourseSources(race,{seeds:[{url:home}],now,maxAssets:0,get:async url=>({...receipt(url===home?root:wrong,{checkedAt:later,text:published}),requestedUrl:url,finalUrl:url})});
 assert(next.observations.some(p=>p.url===origin&&p.editionEvidence?.reason==='content-event-date-conflict'));const merged=mergeCourseDiscoveryIndex({records:[old]},[next],[race])[0],p=merged.resolvedOfficialPages.find(p=>p.url===origin);assert.equal(p.courseContentStatus,'published');assert.equal(p.checkedAt,at);assert.equal(p.sha256,courseDigest(published));
});
test('parent event declaration inherits across unrelated registration ranges and publication stamps',async()=>{
 const home='https://official.example/',root=shell('<a href="/course">course map</a>');
 for(const extra of ['<p>접수기간 2027.01.01 ~ 2027.02.01</p>','<p>접수기간 2027.01.10 ~ 2027.02.15</p>','<p>최종수정 2027.02.15</p>','<p>Registration dates: 2027-01-01 to 2027-02-01</p>','<footer><p>게시일 2026.10.01</p></footer>','<p>게시일 2026.10.01</p>','<meta property="article:published_time" content="2026-10-01">']){
  const child=childDocument(extra);
  const row=await discoverRaceCourseSources(race,{seeds:[{url:home}],now,maxAssets:0,get:async url=>({...receipt(url===home?root:child),requestedUrl:url,finalUrl:url})}),p=row.resolvedOfficialPages.find(p=>p.url===origin);assert.ok(p,extra);assert.equal(p.editionEvidence.method,'same-origin-direct-declaration');assert.equal(p.courseContentStatus,'published');assert.equal(p.checkedAt,at);
 }
});
test('actual local event date, current Event startDate and event metadata conflicts stay fail-closed',async()=>{
 const home='https://official.example/',root=shell('<a href="/course">course map</a>');
 for(const extra of ['<p>대회일 : 2027.03.22</p>','<p>대회일 2027.03.22</p><p>접수마감 2027.03.21</p>','<dl><dt>행사일시</dt><dd>2027년 3월 22일</dd></dl>','<script type="application/ld+json">'+JSON.stringify({'@type':'SportsEvent',name:race.name,startDate:'2027-03-22T09:00:00+09:00'})+'</script>','<meta itemprop="startDate" content="2027-03-22">','<meta name="description" content="2027 Official Race 대회일 2027-03-22">']){
  const child=childDocument(extra);
  const row=await discoverRaceCourseSources(race,{seeds:[{url:home}],now,maxAssets:0,get:async url=>({...receipt(url===home?root:child),requestedUrl:url,finalUrl:url})});assert.ok(!row.resolvedOfficialPages.some(p=>p.url===origin),extra);assert.ok(row.observations.some(p=>/content-event-date-conflict|metadata-event-date-conflict/.test(p.editionEvidence?.reason||'')),extra);
 }
});
