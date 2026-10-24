import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessOfficialCourseChange} from './course-source-refresh-core.mjs';
import {refreshApprovedCourseSources} from './refresh-approved-course-sources.mjs';
import {mkdir,mkdtemp,writeFile,readFile,rm,stat,cp} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const course=JSON.parse(readFileSync(new URL('../apps/mobile/domains/races/course-examples.json',import.meta.url)))[1];
const xml=points=>'<gpx><trk><trkseg>'+points.map(p=>`<trkpt lat="${p.lat}" lon="${p.lon}"><ele>0</ele></trkpt>`).join('')+'</trkseg></trk></gpx>';
const input={pageText:'2026 MBN 서울마라톤 2026.11.15',gpxText:xml(course.segments[0]),checkedAt:'2026-10-23'};
test('official source refresh stages exact edition geometry without deriving fake elevation',()=>{
 const out=assessOfficialCourseChange(course,input);assert.equal(out.geometryChanged,false);assert.equal(out.course.segments[0].length,course.segments[0].length);assert.match(out.course.sourceSha256,/^[a-f0-9]{64}$/);assert.equal(out.course.elevation,undefined);
});
test('official source refresh rejects another year, event, distance and region',()=>{
 for(const change of [{pageText:'2027 MBN 서울마라톤 2027.11.15'},{pageText:'2026 다른대회 2026.11.15'},{gpxText:xml(course.segments[0].slice(0,4))},{gpxText:xml(course.segments[0].map(p=>({...p,lat:p.lat+1})))}])assert.throws(()=>assessOfficialCourseChange(course,{...input,...change}));
});
async function fixture(fn){
 const dir=await mkdtemp(new URL('./.course-refresh-test-',import.meta.url)),root=pathToFileURL(dir+'/');
 const put=async(p,v)=>{const url=new URL(p,root);await mkdir(new URL('./',url),{recursive:true});await writeFile(url,typeof v==='string'?v:JSON.stringify(v));};
 await put('data/course-base.json',[course]);await put('data/course-elevation.json',{schemaVersion:1,profiles:[]});await put('apps/mobile/domains/races/course-examples.json',[{id:'stale-mobile'}]);await put('apps/mobile/domains/races/course-elevation.json',{schemaVersion:1,profiles:[{courseId:'stale-mobile'}]});
 try{return await fn({root,put});}finally{await rm(dir,{recursive:true,force:true});}
}
const source=async url=>url===course.sourcePage?input.pageText:input.gpxText;
test('import is inert: does not fetch, print, or create reports',()=>{
 const url=new URL('./refresh-approved-course-sources.mjs',import.meta.url).href;
 const child=spawnSync(process.execPath,['--input-type=module','-e',`globalThis.fetch=()=>{throw Error('network on import')};await import(${JSON.stringify(url)});`],{encoding:'utf8'});assert.equal(child.status,0,child.stderr);assert.equal(child.stdout,'');
});
test('offline check reads canonical base/elevation and creates no outputs or rewrites',async()=>fixture(async({root})=>{
 const before=await readFile(new URL('data/course-base.json',root),'utf8');let requests=0;
 const r=await refreshApprovedCourseSources({root,check:true,getSource:async()=>{requests++;throw Error('unexpected');}});assert.equal(requests,0);assert.equal(r.rewritten,false);assert.equal(r.profiles,0);assert.equal(r.baseInput,new URL('data/course-base.json',root).href);assert.equal(r.baseWriteURL,r.baseInput);assert.equal(r.elevationInput,new URL('data/course-elevation.json',root).href);assert.equal(await readFile(new URL('data/course-base.json',root),'utf8'),before);await assert.rejects(stat(new URL('outputs/',root)),{code:'ENOENT'});
}));
test('write refresh updates canonical base only and preserves mobile plus elevation bytes',async()=>fixture(async({root})=>{
 const paths=['apps/mobile/domains/races/course-examples.json','apps/mobile/domains/races/course-elevation.json','data/course-elevation.json'],before=await Promise.all(paths.map(p=>readFile(new URL(p,root),'utf8')));
 const r=await refreshApprovedCourseSources({root,write:true,getSource:source,now:new Date('2026-10-24T00:00:00Z')});assert.equal(r.rewritten,true);const rows=JSON.parse(await readFile(new URL('data/course-base.json',root),'utf8'));assert.equal(rows[0].checkedAt,'2026-10-24');assert.deepEqual(rows[0].segments,course.segments);assert.deepEqual(await Promise.all(paths.map(p=>readFile(new URL(p,root),'utf8'))),before);
}));
test('legacy fallback writes canonical target, never legacy input',async()=>fixture(async({root,put})=>{
 await rm(new URL('data/course-base.json',root));await rm(new URL('data/course-elevation.json',root));await put('apps/mobile/domains/races/course-examples.json',[course]);const before=await readFile(new URL('apps/mobile/domains/races/course-examples.json',root),'utf8');
 const check=await refreshApprovedCourseSources({root,check:true});assert.match(check.baseInput,/apps\/mobile/);assert.match(check.baseWriteURL,/data\/course-base.json$/);await assert.rejects(stat(new URL('data/course-base.json',root)),{code:'ENOENT'});
 await refreshApprovedCourseSources({root,write:true,getSource:source});assert.equal(await readFile(new URL('apps/mobile/domains/races/course-examples.json',root),'utf8'),before);assert.equal(JSON.parse(await readFile(new URL('data/course-base.json',root),'utf8'))[0].id,course.id);await assert.rejects(stat(new URL('data/course-elevation.json',root)),{code:'ENOENT'});
}));
test('corrupt canonical base/elevation and conflicting check/write fail before requests or writes',async()=>fixture(async({root,put})=>{
 let requests=0;const getSource=async()=>{requests++;return'';};
 await assert.rejects(refreshApprovedCourseSources({root,check:true,write:true,getSource}),/mutually/);
 await put('data/course-elevation.json','{bad');await assert.rejects(refreshApprovedCourseSources({root,write:true,getSource}));await put('data/course-elevation.json',{schemaVersion:1,profiles:[]});await put('data/course-base.json','{bad');await assert.rejects(refreshApprovedCourseSources({root,write:true,getSource}));assert.equal(requests,0);await assert.rejects(stat(new URL('outputs/',root)),{code:'ENOENT'});
}));
test('failed exact-edition evidence or concurrent metadata replacement never overwrites canonical',async()=>fixture(async({root,put})=>{
 const before=await readFile(new URL('data/course-base.json',root),'utf8');await assert.rejects(refreshApprovedCourseSources({root,write:true,getSource:async url=>url===course.sourcePage?'2027 other 2027.11.15':input.gpxText}),/Official course check failed/);assert.equal(await readFile(new URL('data/course-base.json',root),'utf8'),before);
 let changed=false;await assert.rejects(refreshApprovedCourseSources({root,write:true,getSource:async url=>{if(!changed){changed=true;await put('data/course-base.json',[{...course,id:'new-owner-row'}]);}return source(url);}}),/metadata changed/);assert.equal(JSON.parse(await readFile(new URL('data/course-base.json',root),'utf8'))[0].id,'new-owner-row');await assert.rejects(stat(new URL('outputs/',root)),{code:'ENOENT'});
}));
test('remote canonical elevation check supports absent profiles but rejects any invalid supplied profile without rewriting',async()=>fixture(async({root,put})=>{
 await mkdir(new URL('scripts/',root));await mkdir(new URL('apps/mobile/assets/course-src/',root),{recursive:true});
 for(const file of ['update-course-elevation.mjs','course-metadata-inputs.mjs'])await cp(new URL('./'+file,import.meta.url),new URL('scripts/'+file,root));
 await cp(new URL('../apps/mobile/assets/course-src/elevation-profile.mjs',import.meta.url),new URL('apps/mobile/assets/course-src/elevation-profile.mjs',root));
 const run=()=>spawnSync(process.execPath,[new URL('scripts/update-course-elevation.mjs',root).pathname,'--check'],{encoding:'utf8'});
 const before=await readFile(new URL('data/course-base.json',root),'utf8'),valid=run();assert.equal(valid.status,0,valid.stderr);assert.deepEqual(JSON.parse(valid.stdout).geometryOnly,[course.id]);assert.equal(await readFile(new URL('data/course-base.json',root),'utf8'),before);
 for(const profiles of [[{courseId:course.id}],[{courseId:'orphan'}],[{courseId:course.id},{courseId:course.id}]]){await put('data/course-elevation.json',{schemaVersion:1,profiles});const before=await readFile(new URL('data/course-elevation.json',root),'utf8');assert.notEqual(run().status,0);assert.equal(await readFile(new URL('data/course-elevation.json',root),'utf8'),before);}
}));
