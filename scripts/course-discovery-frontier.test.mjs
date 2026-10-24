import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
import{courseDigest,discoverRaceCourseSources,validCourseNavigationFrontier,materializeCoursePage,discoverDeclaredCourseAssets,mergeCourseDiscoveryIndex}from'./course-discovery-core.mjs';
import{createCourseSourceRetriever}from'./course-discovery-fetch.mjs';
import{approveDiscoveredImages}from'./course-discovery-approval.mjs';
const origin='https://event.example',at='2027-04-18T00:00:00.000Z',now=Date.parse(at),seeds=[{url:origin+'/'}];
const race={id:'new-frontier-event',name:'2027 별빛 마라톤',raceDate:'2027-04-18',distances:['Full','Half','10K','5K']};
const names=['Full','Half','10km','5km'],nav=names.map(k=>`<a href="/ko/course-${k}">${k} 코스 안내</a>`).join('');
const root='<title>2027 별빛 마라톤</title><h1>2027 별빛 마라톤</h1><p>2027.04.18</p>'+nav;
const wrapper='<meta http-equiv="refresh" content="0;url=ko/">';
const image=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(image);image.writeUInt32BE(13,8);image.write('IHDR',12);image.writeUInt32BE(400,16);image.writeUInt32BE(300,20);
const receipt=(url,text,type='text/html')=>({ok:true,requestedUrl:url,finalUrl:url,body:Buffer.from(text),text:typeof text==='string'?text:undefined,contentType:type,sha256:courseDigest(text),checkedAt:at});
function runFixture({rootText=root,frontier=[],event=race,seedInput=seeds,failAnchor=false}={}){
 const seen=[],retriever=createCourseSourceRetriever({live:true,now:()=>now,limits:{maxRequests:4,minHostGapMs:0},resolveDNS:async()=>[{address:'93.184.216.34',family:4}],requestImpl:async url=>{
  seen.push(url);if(url.endsWith('/robots.txt'))return{status:404,headers:{},body:Buffer.alloc(0)};
  let body,type='text/html';if(url===origin+'/')body=wrapper;else if(url===origin+'/ko/'){if(failAnchor)throw Error('source-timeout');body=rootText;}
  else if(url.includes('/image-')){body=image;type='image/png';}else{const key=url.split('course-')[1];body=`<title>2027 별빛 마라톤 ${key} 코스 안내</title>${nav}<img alt="${key} 코스도" src="/image-${key}.png">`;}
  return{status:200,headers:{'content-type':type},body:Buffer.from(body)};
 }});retriever.beginRace(event.id,{maxRequests:4});
 return{seen,retriever,result:()=>discoverRaceCourseSources(event,{seeds:seedInput,get:(u,o)=>retriever.get(u,o),frontier,now})};
}
test('cold meta+robots chain persists navigation frontier and four fresh 4-GET runs eventually fetch all four discipline images',async()=>{
 let frontier=[],approved=[],first;const visits=[];
 for(let i=0;i<5;i++){
  const f=runFixture({frontier}),row=await f.result();if(i===0)first=row;
  assert(f.retriever.stats().newRequests<=4);assert(f.retriever.stats().perRace[race.id]<=4);visits.push(f.seen);
  const result=approveDiscoveredImages(approved,row.candidates,[race],{now});assert.equal(result.quarantine.length,0);approved=result.approved;
  // JSON round-trip models the SAME metadata index between totally cold processes.
  frontier=JSON.parse(JSON.stringify(row.navigationFrontier));assert(frontier.length<=16);
 }
 assert.equal(first.candidates.length,0);assert(first.navigationFrontier.some(f=>f.url.endsWith('course-Full')));
 assert.equal(approved.length,4);assert.deepEqual(approved.map(c=>c.distanceLabel).sort(),['10K','5K','풀코스','하프'].sort());
 assert(visits.slice(1).every(v=>!v.includes(origin+'/')),'resume must not restart the meta wrapper on every run');
 assert(approved.every(c=>c.segments.length===0&&c.sourceKind==='official-image'));
 for(const c of approved.filter(c=>['하프','풀코스'].includes(c.distanceLabel))){assert.equal(c.discoveryEvidence.distanceBasis,'standard-category-nominal');assert.equal(c.discoveryEvidence.distanceIsMeasuredRoute,false);}
});
test('frontier cannot cross event, date, current seed, origin, private literal, TTL or missing hash boundaries',async()=>{
 const row=await runFixture().result(),base=row.navigationFrontier[0];assert(base);
 for(const change of [{eventId:'another-event'},{raceDate:'2028-04-18'},{seedURL:'https://other.example/'},{url:'https://foreign.example/course'},{anchorURL:'https://127.0.0.1/'},{checkedAt:'2020-01-01'},{anchorSha256:'bad'}])assert.deepEqual(validCourseNavigationFrontier(race,seeds,[{...base,...change}],{now}),[],JSON.stringify(change));
 assert.equal(validCourseNavigationFrontier(race,seeds,Array(30).fill(base),{now}).length,16);
});
test('resume rechecks current anchor edition and declaration; old hints never grant inherited approval',async()=>{
 const frontier=(await runFixture().result()).navigationFrontier;
 const changed=runFixture({frontier,rootText:root.replaceAll('2027','2028').replace('2028.04.18','2028.04.19')}),a=await changed.result();
 assert.equal(a.candidates.length,0);assert(a.issues.some(i=>i.reason==='frontier-anchor-current-exact-edition-required'));assert(!changed.seen.some(u=>u.includes('/image-')));
 const removed=runFixture({frontier,rootText:root.replace(/<a[^>]*>[^<]*<\/a>/g,'')}),b=await removed.result();
 assert.equal(b.candidates.length,0);assert(b.issues.some(i=>i.reason==='frontier-target-no-longer-declared'));assert(!removed.seen.some(u=>u.includes('course-')));
});
test('temporary anchor failure retains dated frontier, without freshening proofs or inventing progress',async()=>{
 const frontier=(await runFixture().result()).navigationFrontier,f=runFixture({frontier,failAnchor:true}),row=await f.result();
 assert.equal(row.candidates.length,0);assert.deepEqual(row.navigationFrontier,frontier);assert(row.navigationFrontier.every(x=>x.checkedAt===at));assert(f.retriever.stats().newRequests<=4);
});
test('other same-edition anchors are retained while one anchor progresses, never silently discarded',async()=>{
 const first=await runFixture().result(),extra={...first.navigationFrontier[0],anchorURL:origin+'/another-anchor',url:origin+'/another-course'},f=runFixture({frontier:[...first.navigationFrontier,extra]}),row=await f.result();
 assert(row.navigationFrontier.some(x=>x.anchorURL===extra.anchorURL&&x.url===extra.url));
});
test('partial bounded refresh retains other verified pages with their original source hash and checkedAt',async()=>{
 const prior=await runFixture().result(),old={...prior.resolvedOfficialPages.at(-1),url:origin+'/older-course'},previous={records:[{...prior,resolvedOfficialPages:[...prior.resolvedOfficialPages,old]}]},fresh=await runFixture({frontier:prior.navigationFrontier}).result(),merged=mergeCourseDiscoveryIndex(previous,[fresh],[race])[0];
 const retained=merged.resolvedOfficialPages.find(p=>p.url===old.url);assert(retained);assert.equal(retained.sha256,old.sha256);assert.equal(retained.checkedAt,old.checkedAt);assert.deepEqual(merged.navigationFrontier,fresh.navigationFrontier);
});
test('Half/Full image nominal classification is allowed but missing numeric GPX proof still blocks any GPX request',async()=>{
 const calls=[],get=async(url,{kind})=>{calls.push({url,kind});if(kind==='page')return receipt(url,root+`<h2>Half 코스 안내</h2><a href="/course-half.gpx">Half 코스 GPX</a><img alt="Half 코스도" src="/course-half.png">`);return receipt(url,image,'image/png');};
 const row=await discoverRaceCourseSources({...race,distances:['Half']},{seeds:[{url:origin+'/course'}],get,now});
 assert.equal(row.candidates.length,1);assert.equal(row.candidates[0].sourceKind,'official-image');assert(row.issues.some(i=>i.reason.startsWith('gpx-named-discipline-numeric')));assert(!calls.some(c=>c.kind==='gpx'));
 const c=row.candidates[0],bad={...c,officialDistanceKm:99};assert.equal(approveDiscoveredImages([],[bad],[{...race,distances:['Half']}],{now}).quarantine[0].reason,'invalid-image-category-nominal-metadata');
});
test('shared elevation graphic is not mistaken for a discipline course map',()=>{
 const page=materializeCoursePage('<title>Full 코스 안내</title><a href="/course">Full</a><img src="/course/full.jpg"><img src="/course/high_and_low.jpg">',origin+'/course');
 assert.deepEqual(discoverDeclaredCourseAssets(race,page,{pageKind:'course'}).map(a=>a.url),[origin+'/course/full.jpg']);
});
test('rejected broad linked-image context does not poison the same image with its own valid declaration',()=>{
 const page=materializeCoursePage('<title>Full 코스 안내</title><section><a href="/course/full.jpg"><img alt="Full 코스도" src="/course/full.jpg"></a><h4>고저도</h4><img src="/course/high_and_low.jpg"></section>',origin+'/course');
 assert.deepEqual(discoverDeclaredCourseAssets(race,page,{pageKind:'course'}).map(a=>a.url),[origin+'/course/full.jpg']);
});
test('scheduled runner persists frontier in the same metadata index and reports pending work, not autonomous completion',async()=>{
 const runner=await readFile(new URL('./course-discover-sources.mjs',import.meta.url),'utf8');assert.match(runner,/frontier:old\?\.navigationFrontier/);assert.match(runner,/pendingNavigationRecords/);assert.match(runner,/pendingNavigationPages/);
 const source=await readFile(new URL('./course-discovery-core.mjs',import.meta.url),'utf8');assert.match(source,/navigationFrontier:pending/);assert.doesNotMatch(source,/frontier.*requiresDEM:false/);
});
