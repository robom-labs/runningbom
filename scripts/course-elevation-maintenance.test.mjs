import test from'node:test';import assert from'node:assert/strict';import{readFile,writeFile,mkdir,mkdtemp,rm,stat}from'node:fs/promises';import{pathToFileURL}from'node:url';
import{maintainCourseElevation,boundedLiveElevation}from'./maintain-course-elevation.mjs';import{retainQualifiedProfiles}from'./course-elevation-maintenance-core.mjs';
import{buildCourseCatalog}from'./course-catalog-build.mjs';import{verifyCoursePair}from'./course-data-publication.mjs';
import{updateCourseElevation}from'./update-course-elevation.mjs';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8')),base=await read('data/course-base.json'),previous=await read('data/course-elevation.json'),courses=base.filter(c=>c.sourceKind==='official-gpx'),now=Date.parse(previous.profiles[0].checkedAt)+60000;
const fail=async()=>{throw Error('provider-unavailable');};
async function fixture(fn){const dir=await mkdtemp(new URL('./.elevation-maintenance-test-',import.meta.url)),root=pathToFileURL(dir+'/');await mkdir(new URL('data/',root));await mkdir(new URL('scripts/',root));const put=(p,v)=>writeFile(new URL(p,root),typeof v==='string'?v:JSON.stringify(v));await put('data/course-base.json',base);await put('data/course-elevation.json',previous);try{return await fn({root,put});}finally{await rm(dir,{recursive:true,force:true});}}
test('provider failure retains only reconstructed source-qualified profiles with byte-identical timestamps/receipts',async()=>fixture(async({root})=>{
 const before=await readFile(new URL('data/course-elevation.json',root),'utf8'),r=await maintainCourseElevation({root,now,liveRunner:fail});assert.equal(r.health.status,'degraded-retained-qualified');assert.equal(r.health.liveFailure.code,'LIVE_ELEVATION_FAILED');assert.deepEqual(r.elevation,previous);assert.equal(await readFile(new URL('data/course-elevation.json',root),'utf8'),before);assert(r.health.collectorFailureRecertifiesNothing);await assert.rejects(stat(new URL('outputs/',root)),{code:'ENOENT'});
}));
test('changed source hash, route, edition or event drops incompatible profiles and permits verified geometry-only catalog',()=>{
 for(const change of [c=>c.sourceSha256='b'.repeat(64),c=>c.segments[0][0].lat+=.00001,c=>c.raceDate='2026-11-16',c=>c.eventId='new-edition']){const rows=structuredClone(base);change(rows.find(c=>c.id===courses[0].id));const retained=retainQualifiedProfiles(rows.filter(c=>c.sourceKind==='official-gpx'),previous,{now});assert(retained.geometryOnly.includes(courses[0].id));assert(retained.dropped.some(p=>p.courseId===courses[0].id));const built=buildCourseCatalog({courses:rows,elevation:retained.elevation,now});assert.equal(verifyCoursePair(built.text,built.manifest,{approvedCourses:rows,now}).geometryOnlyGPX,1);}
});
test('orphan, duplicate, invalid and structurally unqualified profiles never survive fallback',()=>{
 const one=[courses[0]],good=previous.profiles.find(p=>p.courseId===one[0].id);
 for(const change of [p=>p.eventId='other',p=>p.routeHash='b'.repeat(64),p=>p.structureMask.status='unavailable',p=>p.source=null,p=>p.segments[0].forEach(x=>x.elevationM=0),p=>p.segments[0][0].elevationM+=.01,p=>p.checkedAt=new Date(now).toISOString()]){const p=structuredClone(good);change(p);const r=retainQualifiedProfiles(one,{...previous,profiles:[p]},{now});assert.equal(r.elevation.profiles.length,0);assert.equal(r.dropped.length,1);}
 for(const profiles of [[{...good,courseId:'orphan'}],[null],[good,good]]){const r=retainQualifiedProfiles(one,{...previous,profiles},{now});assert.equal(r.elevation.profiles.length,0);assert.equal(r.dropped.length,profiles.length);}
});
test('profile cannot qualify without authentic, fresh GPX/DEM/structure receipts even if numeric profile is renderable',()=>{
 const good=previous.profiles[0],one=courses.filter(c=>c.id===good.courseId);
 for(const change of [p=>p.retrievalEvidence.requests=[],p=>p.retrievalEvidence.requests[0].responseText+=' ',p=>p.retrievalEvidence.requests.forEach(r=>r.checkedAt='2020-01-01T00:00:00Z')]){const envelope=structuredClone({...previous,profiles:[good]});change(envelope);assert.equal(retainQualifiedProfiles(one,envelope,{now}).elevation.profiles.length,0);}
 assert.equal(retainQualifiedProfiles(one,{...previous,profiles:[good]},{now:now+31*86400000}).elevation.profiles.length,0);
});
test('a partial/unqualified live result cannot replace previous qualified evidence',async()=>fixture(async({root})=>{
 for(const live of [{schemaVersion:1,profiles:[]},{...previous,profiles:previous.profiles.map(p=>({...p,structureMask:{status:'unavailable'}}))}]){const r=await maintainCourseElevation({root,now,liveRunner:async()=>live});assert.equal(r.health.status,'degraded-retained-qualified');assert.deepEqual(r.elevation,previous);}
 const success=await maintainCourseElevation({root,now,liveRunner:async()=>previous});assert.equal(success.health.status,'live-qualified');assert.equal(success.health.liveFailure,null);assert.deepEqual(success.elevation.profiles,previous.profiles);
}));
test('write commits only canonical filtered elevation and explicit failure health; never recertifies retained profile',async()=>fixture(async({root,put})=>{
 const bad=structuredClone(previous);bad.profiles[0].officialGPXsha='b'.repeat(64);await put('data/course-elevation.json',bad);const baseBefore=await readFile(new URL('data/course-base.json',root),'utf8'),r=await maintainCourseElevation({root,now,write:true,liveRunner:fail});assert.equal(r.rewritten,true);const saved=JSON.parse(await readFile(new URL('data/course-elevation.json',root),'utf8')),health=JSON.parse(await readFile(new URL('outputs/operations/course-elevation-health.json',root),'utf8'));assert.equal(saved.profiles.length,previous.profiles.length-1);assert.equal(health.liveFailure.reason,'provider-unavailable');assert.equal(health.droppedPreviousProfiles.length,1);assert.equal(health.retainedProfiles[0].checkedAt,saved.profiles[0].checkedAt);assert.equal(await readFile(new URL('data/course-base.json',root),'utf8'),baseBefore);
}));
test('provider failure with no qualifying previous profile emits geometry-only health and no invented heights',async()=>fixture(async({root,put})=>{
 await put('data/course-elevation.json',{...previous,profiles:previous.profiles.map(p=>({...p,officialGPXsha:'b'.repeat(64)}))});const r=await maintainCourseElevation({root,now,write:true,liveRunner:fail});assert.equal(r.health.status,'degraded-geometry-only');assert.equal(r.elevation.profiles.length,0);assert.deepEqual(r.health.geometryOnly,courses.map(c=>c.id));assert.equal(r.health.droppedPreviousProfiles.length,previous.profiles.length);
}));
test('offline check is no-write/no-network, while concurrent approved-source changes refuse overwrite',async()=>fixture(async({root,put})=>{
 const checked=await maintainCourseElevation({root,now,check:true,liveRunner:()=>{throw Error('must not run');}});assert(checked.offline);await assert.rejects(stat(new URL('outputs/',root)),{code:'ENOENT'});const before=await readFile(new URL('data/course-elevation.json',root),'utf8');await assert.rejects(maintainCourseElevation({root,now,write:true,liveRunner:async()=>{await put('data/course-base.json',base.map(c=>({...c,notice:'concurrent main edit'})));throw Error('provider-failure');}}),/Concurrent/);assert.equal(await readFile(new URL('data/course-elevation.json',root),'utf8'),before);
}));
test('bounded child enforces wall time, stdout parse, failure discard and Overpass-only argv without real network',async()=>fixture(async({root,put})=>{
 await put('scripts/update-course-elevation.mjs',"if(!process.argv.includes('--stdout')||!process.argv.includes('--overpass-only')||process.argv.includes('--osm-api'))process.exit(4);console.log(JSON.stringify({schemaVersion:1,profiles:[]}));");assert.deepEqual(await boundedLiveElevation({root,maxLiveMs:1000}),{schemaVersion:1,profiles:[]});
 await put('scripts/update-course-elevation.mjs',"process.stdout.write('{partial');process.exit(7)");await assert.rejects(boundedLiveElevation({root,maxLiveMs:1000}),/exit:7/);
 await put('scripts/update-course-elevation.mjs',"console.log('not json')");await assert.rejects(boundedLiveElevation({root,maxLiveMs:1000}),/invalid-json/);
 await put('scripts/update-course-elevation.mjs',"process.stdout.write(Buffer.alloc(16000001,120))");await assert.rejects(boundedLiveElevation({root,maxLiveMs:1000}),/output-limit/);
 await put('scripts/update-course-elevation.mjs',"setInterval(()=>{},1000)");await assert.rejects(boundedLiveElevation({root,maxLiveMs:40}),/timeout/);
}));
test('overpass-only ignores historical original-OSM receipts; provider failure remains bounded and writes nothing',async()=>{
 const original=globalThis.fetch,seen=[],before=await readFile(new URL('data/course-elevation.json',root),'utf8');globalThis.fetch=async url=>{seen.push(String(url));return new Response('',{status:404});};
 try{await assert.rejects(updateCourseElevation(['--refresh','--stdout','--overpass-only']),/HTTP 404/);}finally{globalThis.fetch=original;}
 assert.equal(seen.length,1);assert(seen[0].startsWith('https://overpass-api.de/api/interpreter?data='));assert(!seen.some(u=>u.startsWith('https://api.openstreetmap.org/')));assert.equal(await readFile(new URL('data/course-elevation.json',root),'utf8'),before);
});
test('workflow leaves exact GPX refresh fail-closed, tests wrapper first, retains health and makes no original OSM API request',async()=>{
 const workflow=await readFile(new URL('.github/workflows/refresh-course-catalog.yml',root),'utf8');assert(workflow.indexOf('refresh-approved-course-sources.mjs --write')<workflow.indexOf('maintain-course-elevation.mjs --write'));assert(workflow.includes('scripts/course-elevation-maintenance.test.mjs'));assert(workflow.includes('outputs/operations/course-elevation-health.json'));assert(!workflow.includes('--osm-api'));assert(!/refresh-approved-course-sources[^\n]*(?:\|\| true|continue-on-error)/.test(workflow));
});
