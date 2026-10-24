// Separate review: NOT part of the approved 29-path publication.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCourseSourceRetriever,courseMetaRefreshTarget} from './course-discovery-fetch.mjs';
import {exactCourseEdition,materializeCoursePage,courseDigest} from './course-discovery-core.mjs';
const origin='https://event.example',stamp='2026-10-24T00:00:00.000Z';
const wrapper='<title>36th Marathon 2026</title><meta http-equiv="refresh" content="0;URL=ko/">';
const race={id:'new-jinju-fixture',name:'2026 진주 마라톤',raceDate:'2026-11-22',distances:['10K']};
const event='<title>2026 진주 마라톤</title><h1>진주 마라톤</h1><p>2026년 11월 22일</p><a href="course">10km 코스 안내</a>';
function fixture(routes={},options={}){
 const seen=[],r=createCourseSourceRetriever({live:true,now:()=>Date.parse(stamp),...options,limits:{minHostGapMs:0,...options.limits},resolveDNS:options.resolveDNS||(async()=>[{address:'93.184.216.34',family:4}]),
 requestImpl:async(url)=>{seen.push(url);const x=routes[url]??(url.endsWith('/robots.txt')?{status:404,body:''}:undefined);assert(x,'unexpected read '+url);return{status:x.status??200,headers:x.headers??{'content-type':'text/html'},body:Buffer.from(x.body??'')};}});return{r,seen};
}
test('new official root wrapper traverses declared /ko before exact edition classification',async()=>{
 const {r,seen}=fixture({[origin+'/']:{body:wrapper},[origin+'/ko/']:{body:event}});r.beginRace(race.id);
 const out=await r.get(origin+'/');assert.equal(out.ok,true);assert.equal(out.requestedUrl,origin+'/');assert.equal(out.finalUrl,origin+'/ko/');assert.equal(out.sha256,courseDigest(event));
 assert.equal(exactCourseEdition(race,materializeCoursePage(wrapper,origin+'/')).accepted,false);
 assert.equal(exactCourseEdition(race,materializeCoursePage(out.text,out.finalUrl)).accepted,true);
 assert.deepEqual(seen,[origin+'/robots.txt',origin+'/',origin+'/ko/']);assert.equal(r.stats().perRace[race.id],3);
});
test('HTML case, attribute order, quoted relative URL and entities are deterministic; links/JS are not redirects',()=>{
 assert.equal(courseMetaRefreshTarget('<META content="0; Url=\'ko/?a=1&amp;b=2\'" HTTP-EQUIV="Refresh">',origin+'/'),origin+'/ko/?a=1&b=2');
 assert.equal(courseMetaRefreshTarget('<a href="ko/">Homepage</a><script>location="ko/"</script>',origin+'/'),null);
 assert.equal(courseMetaRefreshTarget('<body><meta http-equiv="refresh" content="0;url=/ko/"></body>',origin+'/'),null);
 for(const content of ['30;url=/ko/','0','0;url=']){
  assert.throws(()=>courseMetaRefreshTarget(`<meta http-equiv="refresh" content="${content}">`,origin+'/'),/unsupported/);
 }
});
test('foreign, private literal, credentials, HTTP, port and script targets fail closed without target reads',async()=>{
 for(const target of ['https://foreign.example/','//foreign.example/','https://127.0.0.1/','https://[::1]/','https://u:p@event.example/','http://event.example/','https://event.example:444/','javascript:alert(1)']){
  const {r,seen}=fixture({[origin+'/']:{body:`<meta http-equiv="refresh" content="0;url=${target}">`}});
  const out=await r.get(origin+'/');assert.equal(out.ok,false,target);assert.match(out.reason,/unsafe/);assert.equal(seen.length,2);
 }
});
test('meta target DNS uses the existing public-address gate and no private request is sent',async()=>{
 let dns=0;const {r,seen}=fixture({[origin+'/']:{body:wrapper}},{resolveDNS:async()=>[{address:++dns<3?'93.184.216.34':'127.0.0.1',family:4}]});
 assert.match((await r.get(origin+'/')).reason,/private/);assert.equal(seen.length,2);
});
test('robots applies before a meta-refresh target request',async()=>{
 const {r,seen}=fixture({[origin+'/robots.txt']:{body:'User-agent: *\nDisallow: /ko/'},[origin+'/']:{body:wrapper}});
 assert.equal((await r.get(origin+'/')).reason,'robots-disallow');assert.equal(seen.length,2);
});
test('HTTP and meta hops share one redirect cap and loops stop before duplicate network reads',async()=>{
 const routes={[origin+'/']:{status:302,headers:{location:'/a'}},[origin+'/a']:{body:'<meta http-equiv="refresh" content="0;url=/b">'},[origin+'/b']:{status:302,headers:{location:'/c'}},[origin+'/c']:{body:'<meta http-equiv="refresh" content="0;url=/d">'}};
 const {r,seen}=fixture(routes);assert.match((await r.get(origin+'/')).reason,/excess-redirect/);assert(!seen.includes(origin+'/d'));assert.equal(seen.length,5);
 const loop=fixture({[origin+'/']:{body:wrapper},[origin+'/ko/']:{body:'<meta http-equiv="refresh" content="0;url=/">'}});
 assert.equal((await loop.r.get(origin+'/')).reason,'redirect-loop');assert.equal(loop.seen.length,3);
});
test('global and per-race budgets count every wrapper, target, robots and HTTP hop',async()=>{
 for(const perRace of [false,true]){
  const {r,seen}=fixture({[origin+'/']:{body:wrapper},[origin+'/ko/']:{status:302,headers:{location:'/landing'}},[origin+'/landing']:{body:'<meta http-equiv="refresh" content="0;url=/final">'}},{limits:{minHostGapMs:0,maxRequests:perRace?24:4}});
  if(perRace)r.beginRace(race.id,{maxRequests:4});assert.match((await r.get(origin+'/')).reason,/network-budget/);assert.equal(seen.length,4);assert.equal(r.stats().newRequests,4);
 }
});
test('meta parsing is page-only and conflicting declarations fail closed',async()=>{
 const {r,seen}=fixture({[origin+'/map']:{headers:{'content-type':'image/png'},body:wrapper}});assert.equal((await r.get(origin+'/map',{kind:'image'})).ok,true);assert.equal(seen.length,2);
 assert.throws(()=>courseMetaRefreshTarget('<meta http-equiv="refresh" content="0;url=/a"><meta http-equiv="refresh" content="0;url=/b">',origin+'/'),/ambiguous/);
});
test('saved wrapper triggers bounded live revalidation; offline never re-dates it',async()=>{
 const cached={ok:true,requestedUrl:origin+'/',finalUrl:origin+'/',text:wrapper,checkedAt:stamp,verification:'hash-verified-saved-audit'};
 const cache=new Map([[origin+'/',cached]]),{r,seen}=fixture({[origin+'/']:{body:wrapper},[origin+'/ko/']:{body:event}},{cache});
 assert.equal((await r.get(origin+'/')).finalUrl,origin+'/ko/');assert.equal(seen.length,3);assert.equal(cached.checkedAt,stamp);
 const offline=createCourseSourceRetriever({cache,now:()=>Date.parse(stamp)});assert.equal((await offline.get(origin+'/')).reason,'offline-cache-miss');assert.equal(offline.stats().newRequests,0);
});
test('following a wrapper never grants edition approval to a wrong-date destination',async()=>{
 const {r}=fixture({[origin+'/']:{body:wrapper},[origin+'/ko/']:{body:event.replace('11월 22일','11월 23일')}}),out=await r.get(origin+'/');
 assert.equal(out.ok,true);assert.equal(exactCourseEdition(race,materializeCoursePage(out.text,out.finalUrl)).accepted,false);
});
