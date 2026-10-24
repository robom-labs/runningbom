import test from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{spawnSync}from'node:child_process';
import{buildCourseCatalog}from'./course-catalog-build.mjs';import{verifyCoursePair}from'./course-data-publication.mjs';import{courseDigest}from'./course-discovery-core.mjs';
import{readCourseBase,readCourseElevation}from'./course-metadata-inputs.mjs';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
test('real publisher --remote-only --check uses verified pages and identical deterministic common builder',async()=>{
 const [baseInput,images,elevationInput,index,races]=await Promise.all([readCourseBase(root),read('data/course-approved-images.json'),readCourseElevation(root),read('data/course-source-index.json'),read('apps/mobile/src/data/races.json')]);const base=baseInput.courses,elevation=elevationInput.elevation;
 const expected=buildCourseCatalog({courses:[...base,...images],elevation:{schemaVersion:1,profiles:elevation.profiles},index,races:races.races}),text=await readFile(new URL('data/course-catalog.json',root),'utf8'),manifest=await read('data/course-catalog.manifest.json');
 assert.equal(text,expected.text);assert.equal(manifest.sha256,courseDigest(text));assert(expected.catalog.pages.length>0);assert(expected.catalog.pages.every(p=>!('excerpt'in p)&&!('seedURL'in p)&&!('verified'in p)));
 const child=spawnSync(process.execPath,['scripts/publish-course-catalog.mjs','--remote-only','--check'],{cwd:root,encoding:'utf8'});assert.equal(child.status,0,child.stderr);assert.equal(JSON.parse(child.stdout).pages,expected.catalog.pages.length);verifyCoursePair(text,manifest);
 const source=await readFile(new URL('scripts/publish-course-catalog.mjs',root),'utf8');assert.match(source,/buildCourseCatalog/);assert.match(source,/data\/course-source-index\.json/);assert.match(source,/!process\.argv\.includes\('--remote-only'\)/);assert.match(source,/process\.argv\.includes\('--check'\)/);
});
