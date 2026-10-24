import test from'node:test';import assert from'node:assert/strict';import{readFile,writeFile,mkdir,mkdtemp,rm}from'node:fs/promises';import{pathToFileURL}from'node:url';import{join}from'node:path';
import{readCourseBase,readCourseElevation}from'./course-metadata-inputs.mjs';import{readApprovedCourses}from'./course-data-publication.mjs';
import{courseSeedURLs}from'./course-source-seeds.mjs';
async function fixture(fn){const dir=await mkdtemp(new URL('./.course-metadata-test-',import.meta.url)),root=pathToFileURL(dir+'/');try{await mkdir(join(dir,'data'));await mkdir(join(dir,'apps/mobile/domains/races'),{recursive:true});return await fn(root);}finally{await rm(dir,{recursive:true,force:true});}}
const write=(root,path,value)=>writeFile(new URL(path,root),JSON.stringify(value));
test('preferred metadata wins over stale app base; explicit JTBC alias survives and legacy quarantine cannot return',async()=>fixture(async root=>{
 await write(root,'data/course-base.json',[{id:'jtbc-full',eventIds:['schedule-20532f12abdb']}]);await write(root,'apps/mobile/domains/races/course-examples.json',[{id:'chuncheon-full'}]);const result=await readCourseBase(root);assert.equal(result.preferred,true);assert.deepEqual(result.courses,[{id:'jtbc-full',eventIds:['schedule-20532f12abdb']}]);assert(result.writeURL.pathname.endsWith('/data/course-base.json'));
}));
test('legacy fallback is allowed ONLY when metadata is absent and its write target remains data-only',async()=>fixture(async root=>{
 await write(root,'apps/mobile/domains/races/course-examples.json',[{id:'legacy'}]);await write(root,'apps/mobile/domains/races/course-elevation.json',{schemaVersion:1,profiles:[]});const base=await readCourseBase(root),e=await readCourseElevation(root);assert.equal(base.preferred,false);assert.equal(e.preferred,false);assert(base.writeURL.pathname.endsWith('/data/course-base.json'));assert(e.writeURL.pathname.endsWith('/data/course-elevation.json'));
}));
test('corrupt or invalid preferred metadata fails closed instead of falling back to a legacy row',async()=>fixture(async root=>{
 await write(root,'apps/mobile/domains/races/course-examples.json',[{id:'chuncheon-full'}]);await writeFile(new URL('data/course-base.json',root),'{broken');await assert.rejects(()=>readCourseBase(root),SyntaxError);for(const value of[{},[],[{id:'same'},{id:'same'}]]){await write(root,'data/course-base.json',value);await assert.rejects(()=>readCourseBase(root));}
 await write(root,'apps/mobile/domains/races/course-elevation.json',{schemaVersion:1,profiles:[]});await write(root,'data/course-elevation.json',{schemaVersion:2,profiles:[]});await assert.rejects(()=>readCourseElevation(root),/schema/);
}));
test('preferred course elevation metadata is used without editing the legacy app cache',async()=>fixture(async root=>{
 await write(root,'apps/mobile/domains/races/course-elevation.json',{schemaVersion:1,profiles:[{courseId:'legacy'}]});await write(root,'data/course-elevation.json',{schemaVersion:1,profiles:[{courseId:'metadata'}]});const result=await readCourseElevation(root);assert.equal(result.preferred,true);assert.equal(result.elevation.profiles[0].courseId,'metadata');assert.match(await readFile(new URL('apps/mobile/domains/races/course-elevation.json',root),'utf8'),/legacy/);
}));
test('real publisher/checker uses metadata base plus approved images, excludes Chuncheon and keeps JTBC alias',async()=>{
 const base=await readCourseBase(),approved=await readApprovedCourses(),images=JSON.parse(await readFile(new URL('../data/course-approved-images.json',import.meta.url),'utf8'));assert.equal(base.preferred,true);assert.equal(approved.length,base.courses.length+images.length);assert(!approved.some(c=>c.id==='chuncheon-full'));assert.deepEqual(approved.find(c=>c.id==='jtbc-full').eventIds,['schedule-20532f12abdb']);
});
test('source refresh and DEM output paths cannot mutate apps/mobile in the proposed metadata workflow',async()=>{
 const refresh=await readFile(new URL('./refresh-approved-course-sources.mjs',import.meta.url),'utf8'),elevation=await readFile(new URL('./update-course-elevation.mjs',import.meta.url),'utf8');assert.match(refresh,/input=base\.writeURL/);assert.match(elevation,/const OUTPUT=new URL\('\.\.\/data\/course-elevation\.json'/);assert.match(elevation,/readCourseBase\(\)/);assert.match(elevation,/readCourseElevation\(\)/);assert.doesNotMatch(refresh,/input=new URL\('apps\/mobile/);
});
test('metadata seeds bootstrap current edition without native links, never guess next-year or future-race seeds',()=>{
 const race={id:'new-event',raceDate:'2027-04-18'},manifest={schemaVersion:1,sourceIndexSha256:'a'.repeat(64),records:[{eventId:race.id,raceDate:race.raceDate,urls:['https://event.example/']}]};assert.deepEqual(courseSeedURLs(race,manifest),['https://event.example/']);assert.deepEqual(courseSeedURLs({...race,raceDate:'2028-04-18'},manifest),[]);assert.deepEqual(courseSeedURLs({...race,id:'future-event'},manifest),[]);assert.throws(()=>courseSeedURLs(race,{...manifest,records:[{...manifest.records[0],urls:['http://127.0.0.1/']}]}));
});
