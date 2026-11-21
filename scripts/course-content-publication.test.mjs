import test from'node:test';import assert from'node:assert/strict';
import{courseDigest,materializeCoursePage,officialPageKind,exactCourseEdition,discoverRaceCourseSources,mergeCourseDiscoveryIndex}from'./course-discovery-core.mjs';
import{courseCatalogPages}from'./course-source-index-core.mjs';
const origin='https://official.example',at='2026-10-26T18:07:39.724Z',later='2026-10-27T18:07:39.724Z',latest='2026-10-28T18:07:39.724Z';
const race={id:'new-event',name:'2027 별빛 마라톤',raceDate:'2027-03-21',distances:['10K','Full']};
const home='<title>2027 별빛 마라톤</title><main><h1>2027 별빛 마라톤</h1><p>2027년 3월 21일</p><a href="/course">코스안내</a></main>';
const shell=body=>'<title>2027 별빛 마라톤 코스안내</title><main><h1>2027 별빛 마라톤</h1>'+body+'</main>';
const unpublished=shell('<section><p>코스도</p></section><section><p><strong>추후 공개 예정</strong></p></section>');
const published=shell('<h2>10km 코스도</h2><img alt="10km 공식 코스도" src="/course10.png">');
const receipt=(url,html,checkedAt=at)=>({ok:true,requestedUrl:url,finalUrl:url,status:200,body:Buffer.from(html),text:html,sha256:courseDigest(html),contentType:'text/html;charset=UTF-8',checkedAt});
async function observe(html,{checkedAt=at,childOverride,r=race}={}){return discoverRaceCourseSources(r,{seeds:[{url:origin+'/'}],maxPages:2,maxAssets:0,now:Date.parse(latest),get:async url=>url===origin+'/'?receipt(url,home,checkedAt):url===origin+'/course'?(childOverride||receipt(url,html,checkedAt)):{ok:false,reason:'offline-cache-miss'}});}
const merge=(old,next,r=race)=>mergeCourseDiscoveryIndex({records:[old]},[next],[r])[0];
const proof=row=>row.resolvedOfficialPages.find(p=>p.url===origin+'/course');
const idx=row=>({schemaVersion:1,sourceRecordCount:1,sourceSnapshotSha256:'a'.repeat(64),records:[row]});

test('two portable explicit unpublished discipline fixtures bind their own original HTML bytes',()=>{
 for(const discipline of ['10K','Full']){
  const html=shell('<h2>'+discipline+' 코스안내</h2><section><p>코스도</p></section><section><p>추후 공개 예정</p></section>'),body=Buffer.from(html),sha=courseDigest(body);
  const page=materializeCoursePage(body.toString('utf8'),origin+'/course');
  assert.equal(courseDigest(body),sha);assert.equal(page.courseContent.status,'unpublished');assert.equal(officialPageKind(page,{label:'코스안내'}),'event');
  assert.deepEqual(page.courseContent.evidence,[{basis:'adjacent-course-heading-and-status',heading:'코스도',text:'추후 공개 예정'}]);
 }
});
test('portable declared overview/course placeholder stays verified event/info without a published course tier',async()=>{
 const row=await observe(unpublished),current=proof(row);
 assert.ok(current);assert.equal(current.verified,true);assert.equal(current.pageKind,'event');assert.equal(current.courseContentStatus,'unpublished');
 assert.equal(current.sha256,courseDigest(unpublished));assert.equal(current.checkedAt,at);assert.equal(current.courseContentEvidence.sourceSha256,current.sha256);assert.equal(current.editionEvidence.raceDate,race.raceDate);assert.equal(row.status,'verified-event-page');assert.equal(row.candidates.length,0);
 const slim=courseCatalogPages(idx(row),[race],{now:Date.parse(latest)});assert.ok(slim.some(p=>p.url===current.url&&p.kind==='event'));assert.ok(!slim.some(p=>p.url===current.url&&p.kind==='course'));
});
test('general source-bound dedicated course placeholders work across Korean/English text and split widgets',async()=>{
 for(const body of ['<p>코스도 추후 공개 예정</p>','<h2>코스 안내 준비중</h2>','<h2>Course map</h2><p>Coming soon</p>','<p>Route map not yet available</p>','<div><h2>코스도</h2></div><div><p>추후 공개 예정</p></div>']){
  const row=await observe(shell(body)),p=proof(row);assert.ok(p);assert.equal(p.pageKind,'event',body);assert.equal(p.courseContentStatus,'unpublished',body);assert.equal(row.status,'verified-event-page');assert.equal(p.courseContentEvidence.sourceUrl,p.url);assert.equal(p.courseContentEvidence.checkedAt,p.checkedAt);
 }
});
test('footer/banner/navigation/hidden content and unrelated upcoming notices cannot demote a course page',async()=>{
 for(const body of ['<footer><p>코스도 추후 공개 예정</p></footer>','<div class="banner"><p>Course map coming soon</p></div>','<aside><p>코스도 추후 공개 예정</p></aside>','<nav><p>코스도 추후 공개 예정</p></nav>','<div hidden><p>코스도 추후 공개 예정</p></div>','<h2>기념품</h2><p>추후 공개 예정</p>','<p>코스 변경사항은 추후 공지 예정</p>','<p>코스 소개 영상 추후 공개 예정</p>','<h2>코스도</h2><h2>배번호</h2><p>추후 공개 예정</p>','<script>"코스도 추후 공개 예정"</script>','<p>미공개가 아닌 현재 코스도입니다.</p>']){
  const row=await observe(shell(body));assert.equal(proof(row).pageKind,'course',body);assert.notEqual(proof(row).courseContentStatus,'unpublished',body);
 }
});
test('a real separately labelled course asset plus a local future notice is mixed, not a whole-page demotion',async()=>{
 const row=await observe(shell('<h2>10km 코스도</h2><img alt="10km 코스도" src="/course10.png"><p>Full 코스도 추후 공개 예정</p>'));
 assert.equal(proof(row).pageKind,'course');assert.equal(proof(row).courseContentStatus,'mixed');
});
test('intervening long content and negated pending statuses do not manufacture a course-publication hold',async()=>{
 for(const body of ['<h2>코스도</h2><p>'+('일반 안내 내용입니다. '.repeat(50))+'</p><p>추후 공개 예정</p>','<h2>코스도</h2><p>공개 예정이 아닙니다</p>','<p>코스도는 준비 중이 아닙니다</p>','<h2>Course map</h2><p>Not coming soon</p>','<h2>코스도</h2><section>기념품</section><p>추후 공개 예정</p>']){
  const row=await observe(shell(body));assert.equal(proof(row).pageKind,'course',body);assert.notEqual(proof(row).courseContentStatus,'unpublished',body);
 }
});
test('fresh successful unpublished observation supersedes older same-URL course proof and its published fallback tier',async()=>{
 const before=await observe(published),next=await observe(unpublished,{checkedAt:later}),previous=JSON.stringify(before),result=merge(before,next);
 assert.equal(proof(before).pageKind,'course');assert.equal(proof(result).pageKind,'event');assert.equal(proof(result).courseContentStatus,'unpublished');assert.equal(proof(result).sha256,courseDigest(unpublished));assert.equal(proof(result).checkedAt,later);assert.equal(result.status,'verified-event-page');assert.equal(JSON.stringify(before),previous);
 assert.equal(courseCatalogPages(idx(result),[race],{now:Date.parse(latest)}).filter(p=>p.kind==='course').length,0);
});
test('new real map restores the same URL; older successful placeholders cannot roll publication back',async()=>{
 const old=await observe(published),held=merge(old,await observe(unpublished,{checkedAt:later})),restored=merge(held,await observe(published,{checkedAt:latest}));assert.equal(proof(restored).pageKind,'course');assert.equal(proof(restored).courseContentStatus,'published');assert.equal(proof(restored).checkedAt,latest);
 const stale=merge(restored,await observe(unpublished,{checkedAt:later}));assert.deepEqual(proof(stale),proof(restored));assert.equal(stale.status,'verified-course-page');
 const notRestored=merge(held,old);assert.equal(proof(notRestored).pageKind,'event');assert.equal(proof(notRestored).checkedAt,later);
});
test('same receipt SHA/clock may be reclassified without rejuvenating evidence; current successes replace obsolete kinds',async()=>{
 const row=await observe(unpublished),legacy=structuredClone(row);proof(legacy).pageKind='course';delete proof(legacy).courseContentStatus;delete proof(legacy).courseContentEvidence;const merged=merge(legacy,row);assert.equal(proof(merged).pageKind,'event');assert.equal(proof(merged).checkedAt,at);assert.equal(proof(merged).sha256,courseDigest(unpublished));
});
test('failed requests, forged body hash, cross-origin/unsafe response or conflicting edition cannot grant demotion authority',async()=>{
 const old=await observe(published);
 for(const childOverride of [{ok:false,reason:'HTTP503'},{...receipt(origin+'/course',unpublished,later),sha256:'0'.repeat(64)},{...receipt(origin+'/course',unpublished,later),finalUrl:'https://foreign.example/course'},{...receipt(origin+'/course',unpublished,later),finalUrl:'http://official.example/course'},receipt(origin+'/course',unpublished.replaceAll('2027','2026'),later)]){
  const row=await observe(unpublished,{checkedAt:later,childOverride}),result=merge(old,row);assert.equal(proof(result).pageKind,'course');assert.equal(proof(result).sha256,proof(old).sha256);assert.equal(proof(result).checkedAt,at);
 }
 const nextRace={...race,raceDate:'2028-03-21'};assert.equal(merge(old,{...old,raceDate:nextRace.raceDate,resolvedOfficialPages:[],status:'unverified'},nextRace).resolvedOfficialPages.length,0);
});
test('unsafe or mere navigation links cannot masquerade as publication signals to defeat an explicit placeholder',async()=>{
 for(const addition of ['<a href="/course">코스도</a>','<a href="http://127.0.0.1/private.gpx">공식 GPX</a>','<img alt="코스도" src="file:///private/a.png">']){const row=await observe(unpublished.replace('</main>',addition+'</main>'));assert.equal(proof(row).pageKind,'event');assert.equal(proof(row).courseContentStatus,'unpublished');}
});
test('publication evidence describes hashed response bytes, never an unbound receipt text field',async()=>{
 const bodyPublished=await observe(unpublished,{childOverride:{...receipt(origin+'/course',published),text:unpublished}});
 assert.equal(proof(bodyPublished).pageKind,'course');assert.equal(proof(bodyPublished).courseContentStatus,'published');assert.equal(proof(bodyPublished).sha256,courseDigest(published));
 const bodyPending=await observe(published,{childOverride:{...receipt(origin+'/course',unpublished),text:published}});
 assert.equal(proof(bodyPending).pageKind,'event');assert.equal(proof(bodyPending).courseContentStatus,'unpublished');assert.equal(proof(bodyPending).courseContentEvidence.sourceSha256,courseDigest(unpublished));
});
test('inline CSS hidden subtrees, inert templates and conditional comments cannot assert unpublished content',async()=>{
 const notice='<p>코스도추후공개예정</p>';
 for(const style of ['display: none !important',' DISPLAY : NoNe  ! IMPORTANT ; color:red','display:block;display:none','display:none!important;display:block','visibility: hidden','VISIBILITY : collapse !important','display:/**/none /*comment*/ ! important','background:url("display:block;");display:none']){
  for(const asset of ['<img alt="공식 코스도" src="/course.png">','<a href="/original.gpx">공식 GPX</a>']){
   const row=await observe(shell(`<div style='${style}'>${notice}</div>${asset}`));assert.equal(proof(row).pageKind,'course',style);assert.equal(proof(row).courseContentStatus,'published',style);
  }
 }
 for(const content of [`<template>${notice}</template>`,`<!--[if IE]>${notice}<![endif]-->`,`<input type="hidden" value="코스도추후공개예정">`]){const row=await observe(shell(content));assert.equal(proof(row).pageKind,'course');assert.notEqual(proof(row).courseContentStatus,'unpublished');}
 const root=materializeCoursePage('<main style="display:none">'+notice+'</main>',origin+'/course');assert.equal(root.courseContent.status,'unknown');
});
test('quoted CSS URLs and visible winning declarations do not hide real placeholder evidence',async()=>{
 for(const style of ['background:url("display:none;visibility:hidden")','background:url("x; display:none !important;");color:red','display:none;display:block','display:none;display: block !important','display:none!important;display:block!important','visibility:hidden;visibility:visible','visibility:collapse!important;visibility:visible!important','--example:"display:none"','display:var(--display)']){
  const row=await observe(shell(`<div style='${style}'><p>코스도추후공개예정</p></div>`));assert.equal(proof(row).pageKind,'event',style);assert.equal(proof(row).courseContentStatus,'unpublished',style);
 }
});
test('hidden publication signals cannot rescue a visible unpublished page',async()=>{
 for(const asset of ['<img alt="공식 코스도" src="/course.png">','<a href="/original.gpx">공식 GPX</a>']){
  const row=await observe(unpublished.replace('</main>',`<div style="display:none!important">${asset}</div></main>`));assert.equal(proof(row).pageKind,'event');assert.equal(proof(row).courseContentStatus,'unpublished');
 }
});
test('publication signal labels remain hints, not image-content verification',()=>{
 const opaque=materializeCoursePage(shell('<img alt="course" src="/opaque.png"><p>코스도 추후 공개 예정</p>'),origin+'/course');assert.equal(opaque.courseContent.status,'mixed');
 const banner=materializeCoursePage(shell('<img alt="course banner" src="/opaque.png"><p>코스도 추후 공개 예정</p>'),origin+'/course');assert.equal(banner.courseContent.status,'unpublished');
});
test('a shared course/sponsor/gift publication list holds the course without borrowing unrelated pending text',async()=>{
 for(const text of ['러닝 코스, 스폰서, 완주 기념품 추후 공개 예정','Course map, sponsors and finisher gifts coming soon','코스도 및 후원사 추후 공개 예정']){
  const row=await observe(shell('<p>'+text+'</p>'));
  assert.equal(proof(row).courseContentStatus,'unpublished',text);assert.equal(proof(row).pageKind,'event');
  assert.equal(proof(row).courseContentEvidence.sourceSha256,courseDigest(shell('<p>'+text+'</p>')));
 }
 for(const text of ['코스도는 공개 완료, 기념품 추후 공개 예정','코스 변경사항, 기념품 추후 공개 예정','코스 소개 영상, 기념품 추후 공개 예정','Course map published. Sponsors and gifts coming soon','기념품, 스폰서 추후 공개 예정']){
  const row=await observe(shell('<p>'+text+'</p>'));assert.notEqual(proof(row).courseContentStatus,'unpublished',text);
 }
 const mixed=await observe(shell('<img alt="10km 공식 코스도" src="/course10.png"><p>러닝 코스, 스폰서, 완주 기념품 추후 공개 예정</p>'));
 assert.equal(proof(mixed).courseContentStatus,'mixed');assert.equal(proof(mixed).pageKind,'course');
});
test('portable FILA structured shared noun-list hold stays distinct from already published medal and separate sentences',async()=>{
 const r={id:'synthetic-fila-18',name:'2026 FILA RUN & ESPRESSO',raceDate:'2026-11-15',distances:['10K']},url=origin+'/fila-course';
 const html='<title>2026 FILA RUN &amp; ESPRESSO</title><main><h1>2026 FILA RUN &amp; ESPRESSO</h1><p>2026.11.15 SUN / 10K RACE</p><section id="fave-run-and-espresso-course"><h2>RUNNING COURSE</h2><h3>COMING SOON</h3><p><span>러닝 코스, 스폰서, </span><span>완주 기념품 추후 공개 예정</span></p></section><section><h2>FINISHER MEDAL</h2><p>2026.09.28 메달 공개 완료</p><p>Course map published. Sponsors and gifts coming soon</p></section></main>';
 const body=Buffer.from(html),sha=courseDigest(body),page=materializeCoursePage(body.toString('utf8'),url);
 assert.equal(page.courseContent.status,'unpublished');assert.ok(page.courseContent.evidence.some(e=>e.basis==='explicit-course-publication-text'&&e.text==='러닝 코스, 스폰서, 완주 기념품 추후 공개 예정'));assert.ok(!page.courseContent.evidence.some(e=>e.text.includes('Course map published')));assert.equal(exactCourseEdition(r,page).accepted,true);
 const row=await discoverRaceCourseSources(r,{seeds:[{url}],maxPages:1,maxAssets:0,now:Date.parse(at)+1000,get:async()=>receipt(url,html,at)}),p=row.resolvedOfficialPages[0];
 assert.equal(p.pageKind,'event');assert.equal(p.courseContentStatus,'unpublished');assert.equal(p.sha256,sha);assert.equal(p.checkedAt,at);assert.equal(row.candidates.length,0);
 const slim=courseCatalogPages(idx(row),[r],{now:Date.parse(at)+1000});assert.equal(slim[0].kind,'event');assert.equal(slim[0].contentStatus,'unpublished');
});
