import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';import {createHash} from 'node:crypto';
import {verifyCoursePair,overlayCourseRegistry,assertCourseOnlyDelta,assertCoursePagesSource,verifyPublicCourseRegistry} from './course-data-publication.mjs';
const now=Date.parse('2026-10-24T06:00:00Z'),hash=v=>createHash('sha256').update(v).digest('hex');
async function pair(){const courses=JSON.parse(await readFile(new URL('../apps/mobile/domains/races/course-examples.json',import.meta.url),'utf8')),e=JSON.parse(await readFile(new URL('../apps/mobile/domains/races/course-elevation.json',import.meta.url),'utf8'));return encode({schemaVersion:1,revision:'courses-'+'a'.repeat(20),generatedAt:new Date(now).toISOString(),courses,elevation:{schemaVersion:1,profiles:e.profiles}});}
function encode(data){const text=JSON.stringify(data),manifest={schemaVersion:1,revision:data.revision,generatedAt:data.generatedAt,count:data.courses.length,sha256:hash(text),sizeBytes:Buffer.byteLength(text),minimumAppVersion:'0.23.4'};return {text,manifest,data};}
async function temp(fn){const dir=await mkdtemp(new URL('./.course-publication-test-',import.meta.url));try{return await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('course envelope validates source-bound actual geometry/elevation, manifest SHA, byte size and schema',async()=>{
 const {text,manifest,data}=await pair();assert.equal(verifyCoursePair(text,manifest,{now,approvedCourses:data.courses}).count,4);
 for(const change of [m=>m.sha256='b'.repeat(64),m=>m.count++,m=>m.sizeBytes++,m=>m.schemaVersion++,m=>m.revision='wrong']){const m={...manifest};change(m);assert.throws(()=>verifyCoursePair(text,m,{now}));}
 const other=structuredClone(data.courses);other[0].eventId='other';assert.throws(()=>verifyCoursePair(text,manifest,{now,approvedCourses:other}),/approved/);
});
test('source/edition/hash/duplicate/orphan/image-only route or missing GPX enrichment are rejected',async()=>{
 const {data}=await pair();
 for(const mutate of [d=>d.courses[0].raceDate='2027-11-15',d=>d.courses[0].segments[0][0].lat+=.001,d=>d.elevation.profiles.shift(),d=>d.elevation.profiles.push(d.elevation.profiles[0]),d=>d.elevation.profiles[0].courseId='orphan',d=>d.courses.push(d.courses[0]),d=>d.courses[2].segments=[[{lat:1,lon:1},{lat:1,lon:2}]],d=>d.courses[0].sourceUrl='http://insecure.test',d=>d.generatedAt='2020-01-01T00:00:00Z']){const d=structuredClone(data);mutate(d);const p=encode(d);assert.throws(()=>verifyCoursePair(p.text,p.manifest,{now}));}
});
test('overlay changes only two course JSON files and preserves app/APK bytes',async()=>temp(async dir=>{
 const site=join(dir,'site'),dataDir=join(dir,'input');await mkdir(site);await mkdir(dataDir);const {text,manifest}=await pair();
 await writeFile(join(site,'app.js'),'existing app');await writeFile(join(site,'review.apk'),'existing binary');await writeFile(join(dataDir,'course-catalog.json'),text);await writeFile(join(dataDir,'course-catalog.manifest.json'),JSON.stringify(manifest));
 const report=await overlayCourseRegistry(site,dataDir,{now});assert.equal(report.nonCourseFilesUnchanged,true);assert.equal(report.changed.length,2);assert.equal(await readFile(join(site,'review.apk'),'utf8'),'existing binary');assert.equal(await readFile(join(site,'app.js'),'utf8'),'existing app');
 assert.throws(()=>assertCourseOnlyDelta({'app.js':'a'},{'app.js':'b'}),/mutation/);
}));
test('last-good site is untouched when source pair invalid; Pages config cannot be silently changed',async()=>temp(async dir=>{
 const site=join(dir,'site'),input=join(dir,'input');await mkdir(site);await mkdir(input);await writeFile(join(site,'app.js'),'safe');const {text,manifest}=await pair();await writeFile(join(input,'course-catalog.json'),text);await writeFile(join(input,'course-catalog.manifest.json'),JSON.stringify({...manifest,sha256:'0'.repeat(64)}));await assert.rejects(()=>overlayCourseRegistry(site,input,{now}));assert.equal(await readFile(join(site,'app.js'),'utf8'),'safe');
 assertCoursePagesSource({build_type:'legacy',source:{branch:'gh-pages',path:'/'}});assert.throws(()=>assertCoursePagesSource({build_type:'workflow'}));
}));
test('public readback checks served pair, not queued status; mismatch and HTTP errors fail',async()=>temp(async dir=>{
 const {text,manifest}=await pair();await writeFile(join(dir,'course-catalog.json'),text);await writeFile(join(dir,'course-catalog.manifest.json'),JSON.stringify(manifest));
 const fetcher=async url=>new Response(String(url).includes('.manifest.json')?JSON.stringify(manifest):text);
 assert.equal((await verifyPublicCourseRegistry(dir,{fetcher,now})).publicPairVerified,true);
 await assert.rejects(()=>verifyPublicCourseRegistry(dir,{now,fetcher:async()=>new Response('queued',{status:202})}));
 await assert.rejects(()=>verifyPublicCourseRegistry(dir,{now,fetcher:async()=>new Response('gone',{status:404})}));
}));
test('course maintenance workflow is data-only, serialized, bounded, uses agreed generator and actual public readback',async()=>{
 const s=await readFile(new URL('../.github/workflows/refresh-course-catalog.yml',import.meta.url),'utf8');assert.match(s,/update-course-elevation.mjs --refresh --osm-api/);assert.match(s,/refresh-approved-course-sources.mjs --write/);assert.match(s,/publish-course-catalog.mjs --remote-only --check/);assert.match(s,/group: pages/);assert.match(s,/group: runningbom-data-writer/);assert.match(s,/course-data-publication.mjs --verify-public/);assert.doesNotMatch(s,/eas |play-release|preview-ota|gh pr|gh workflow run pages.yml/);
});
