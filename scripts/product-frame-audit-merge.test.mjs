import {test} from 'node:test';import assert from 'node:assert/strict';
import {mergeReviewedPhotoFrames} from './product-frame-audit-merge.mjs';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const now=Date.parse('2026-10-24T00:00:00Z'),p={id:'shoe',source:'https://www.nike.com/p/one',imageSource:'https://static.nike.com/a/a.png',image:'/old-bundled.png',imageSha256:'a'.repeat(64)},f={sha256:'b'.repeat(64),imageSource:p.imageSource,productSource:p.source,width:200,height:200,x:10,y:40,cropWidth:180,cropHeight:120,background:'#ffffff',checkedAt:'2026-10-24T00:00:00Z'};
const approval={id:'shoe',approved:true,imageSource:p.imageSource,productSource:p.source,sha256:f.sha256,identitySource:p.source,identityEvidenceSha256:'c'.repeat(64),reviewer:'owner-fixture',reviewedAt:f.checkedAt};
test('controlled candidate cannot change original hashes without explicit exact source identity approval',()=>{
 const r=mergeReviewedPhotoFrames({products:[p]},{shoe:f},[],now);assert.deepEqual(r.catalog.products[0],p);assert.equal(r.report.attached,0);assert.deepEqual(r.report.awaitingApproval,['shoe']);
});
test('approved exact identity changes hash plus numeric frame, not original image bytes; strips stale bundled path',()=>{
 const r=mergeReviewedPhotoFrames({products:[p]},{shoe:f},[approval],now);assert.equal(r.report.attached,1);assert.equal(r.catalog.products[0].imageSha256,f.sha256);assert.equal(r.catalog.products[0].image,p.imageSource);assert.equal(r.catalog.products[0].imageFrame.productSource,p.source);assert.deepEqual(p.imageSha256,'a'.repeat(64));
});
test('identity fix/new source invalidates old frame instead of cropping a wrong-model photo',()=>{
 const r=mergeReviewedPhotoFrames({products:[{...p,imageSource:p.imageSource+'?fixed=1'}]},{shoe:f},[approval],now);assert.equal(r.report.attached,0);assert.deepEqual(r.report.unmatchedCandidate,['shoe']);
});
test('old measurements and invalid geometry cannot become current by an approval date',()=>{
 for(const changed of [{...f,checkedAt:'2026-10-01T00:00:00Z'},{...f,x:-1}]){const r=mergeReviewedPhotoFrames({products:[p]},{shoe:changed},[approval],now);assert.equal(r.report.originalHashChanges,0);assert.equal(r.report.attached,0);}
});
test('scheduled refresh removes stale embedded frame even when there is no replacement or source changed',()=>{
 const old={...p,imageFrame:{...f,sha256:p.imageSha256,checkedAt:'2026-10-01T00:00:00Z'}};
 for(const candidates of [{},{shoe:{...f,imageSource:'https://static.nike.com/a/new.png'}}]){const r=mergeReviewedPhotoFrames({products:[old]},candidates,[],now);assert.equal(r.catalog.products[0].imageFrame,undefined);assert.deepEqual(r.report.removedStaleFrames,['shoe']);assert.ok(old.imageFrame);}
});
test('scheduled refresh preserves an exact last-good frame and original receipt date without replacement',()=>{
 const existing={...p,imageFrame:{...f,sha256:p.imageSha256}};const r=mergeReviewedPhotoFrames({products:[existing]},{},[],now);assert.deepEqual(r.catalog.products[0],existing);assert.deepEqual(r.report.removedStaleFrames,[]);
});
test('duplicate identity approvals fail closed rather than last-write-wins',()=>{assert.throws(()=>mergeReviewedPhotoFrames({products:[p]},{shoe:f},[approval,approval],now),/Duplicate/);});
test('scheduled CLI accepts explicit frame/output paths, preserves input bytes and refuses an overwrite',async()=>{
 const base=resolve((await import('node:os')).tmpdir(),'runningbom-frame-cli-tests');await mkdir(base,{recursive:true});const dir=await mkdtemp(base+'/run-'),catalog=JSON.stringify({products:[p]}),frame={...f,sha256:p.imageSha256,checkedAt:new Date().toISOString()},script=fileURLToPath(new URL('./product-frame-audit-merge.mjs',import.meta.url));
 await writeFile(dir+'/input.json',catalog);await writeFile(dir+'/frames.json',JSON.stringify({candidates:{shoe:frame}}));
 execFileSync(process.execPath,[script,'--catalog',dir+'/input.json','--frames',dir+'/frames.json','--out',dir+'/output']);assert.equal(await readFile(dir+'/input.json','utf8'),catalog);assert.equal(JSON.parse(await readFile(dir+'/output/candidate-catalog-with-frames.json','utf8')).products[0].imageFrame.checkedAt,frame.checkedAt);
 assert.throws(()=>execFileSync(process.execPath,[script,'--catalog',dir+'/output/candidate-catalog-with-frames.json','--frames',dir+'/frames.json','--out',dir+'/output'],{stdio:'pipe'}),/Output would overwrite an input/);
});
