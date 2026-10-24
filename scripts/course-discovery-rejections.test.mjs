import test from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';
import{materializeCoursePage,discoverDeclaredCourseAssets,assessCourseAsset,courseDigest}from'./course-discovery-core.mjs';
const avatar='364a4dd085d7de554210066021a8c79a2709a17e3dc0078c3dd834dac40b4d0e',walk='2ae3e371e7fd5a3752d7e55f6df16b53cc09cd6fd6ecc2bc940937bc4da958d7';
const race={id:'fixture',name:'2027 별빛 마라톤',raceDate:'2027-04-18',distances:['5K','10K']};
test('generic avatar remains rejected even on an otherwise dedicated course page',()=>{
 const page=materializeCoursePage('<title>10km 코스안내</title><img alt="10km 코스도" src="/common/img/default_profile.png"><img class="avatar" alt="10km 코스도" src="/opaque.png">','https://event.example/course');
 assert.deepEqual(discoverDeclaredCourseAssets(race,page,{pageKind:'course'}),[]);
});
test('200x200 raster header fails lower bounds even with image MIME and matching response hash',()=>{
 const body=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(body);body.writeUInt32BE(13,8);body.write('IHDR',12);body.writeUInt32BE(200,16);body.writeUInt32BE(200,20);
 assert.throws(()=>assessCourseAsset(race,{kind:'image',distanceKeys:['5K']},{ok:true,body,sha256:courseDigest(body),contentType:'image/png'}),/image-too-small/);
});
test('explicit3.65km WALK caption cannot borrow5K/10K from the shared board heading',()=>{
 const page=materializeCoursePage('<title>코스확정 안내</title><article><h2>걷기3.65km ·5km·10km 공식 코스</h2><img alt="걷기3.65km 확정 코스도" src="/c9e12126ca1e0.png"><img alt="5km 확정 코스도" src="/3452389ac6512.png"><img alt="10km 확정 코스도" src="/4fccf1e42de50.png"></article>','https://event.example/course');
 const assets=discoverDeclaredCourseAssets(race,page,{pageKind:'course'});assert.deepEqual(assets.map(a=>a.distanceKeys),[[],['5K'],['10K']]);
});
test('both exact rejected hashes are absent from the current approved registry',async()=>{
 const rows=JSON.parse(await readFile(new URL('../data/course-approved-images.json',import.meta.url),'utf8'));
 assert(!rows.some(c=>c.sourceSha256===avatar));
 for(const c of rows.filter(c=>c.sourceSha256===walk)){assert.equal(c.officialDistanceKm,3.65);assert.match(c.distanceLabel,/3\.65/);assert.doesNotMatch(c.distanceLabel,/5\s*k|10\s*k/i);}
});
test('local frozen64 candidate excludes avatar and WALK and retains its declared hash',async t=>{
 const path='/Volumes/RunningbomBuild38/artifacts/v54/course-discovery/frozen-candidate-1/';let text;
 try{text=await readFile(path+'course-catalog.json','utf8');}catch(e){if(e.code==='ENOENT'){t.skip('External frozen candidate is not present in this environment');return;}throw e;}
 const data=JSON.parse(text),manifest=JSON.parse(await readFile(path+'course-catalog.manifest.json','utf8'));assert.equal(data.courses.length,64);assert.equal(data.pages.length,177);assert(!data.courses.some(c=>[avatar,walk].includes(c.sourceSha256)));assert.equal(courseDigest(text),manifest.sha256);assert.equal(manifest.sha256,'e3675e7e7008152bb5eae17a18c9f70cb94572d73a2a52bfbe8ad5eff4fe0f2e');
});
