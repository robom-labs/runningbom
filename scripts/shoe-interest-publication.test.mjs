import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';
import {interestManifest,verifyInterestPair,overlayInterest,assertInterestOnlyDelta,assertInterestPagesSource,verifyPublicInterest} from './shoe-interest-publication.mjs';
const now=Date.parse('2026-10-24T06:00:00Z');
function fixture(){const data={schemaVersion:1,checkedAt:new Date(now).toISOString(),source:'RunRepeat',sourceUrl:'https://runrepeat.com/catalog/running-shoes',metric:'published-page-views',complete:true,rows:Array.from({length:5},(_,i)=>({item_id:'shoe-'+i,rank:i+1,value:100-i,evidenceUrl:'https://runrepeat.com/real-runner-'+i}))};return encode(data);}
function encode(data){const text=JSON.stringify(data)+'\n';return {data,text,manifest:interestManifest(text)};}
async function temp(fn){const dir=await mkdtemp(new URL('./.interest-publication-test-',import.meta.url));try{return await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}
async function save(dir,p){await mkdir(dir,{recursive:true});await writeFile(join(dir,'shoe-interest.json'),p.text);await writeFile(join(dir,'shoe-interest.manifest.json'),JSON.stringify(p.manifest));}
test('manifest uses app contract: schema/checksum/count/checkedAt; measured evidence is not sales or score',()=>{
 const p=fixture();assert.equal(verifyInterestPair(p.text,p.manifest,{now}).count,5);assert.deepEqual(Object.keys(p.manifest).sort(),['checkedAt','count','schemaVersion','sha256']);
 for(const change of [m=>m.sha256='0'.repeat(64),m=>m.count++,m=>m.checkedAt='2020-01-01T00:00:00Z',m=>m.schemaVersion=2]){const m={...p.manifest};change(m);assert.throws(()=>verifyInterestPair(p.text,m,{now}));}
});
test('incomplete, stale, fabricated metric, bad evidence, unknown IDs and duplicated models cannot publish',()=>{
 for(const mutate of [d=>d.complete=false,d=>d.checkedAt='2026-10-20T00:00:00Z',d=>d.metric='sales',d=>d.rows[0].value=0,d=>d.rows[0].rank=.5,d=>d.rows[0].evidenceUrl='http://runrepeat.com/runner',d=>d.rows[0].evidenceUrl='https://runrepeat.com.evil.test/runner',d=>d.rows[0].evidenceUrl='https://runrepeat.com/catalog',d=>d.rows[1].item_id=d.rows[0].item_id,d=>d.rows.pop()]){const p=fixture();mutate(p.data);const v=encode(p.data);assert.throws(()=>verifyInterestPair(v.text,v.manifest,{now}));}
 const p=fixture();assert.throws(()=>verifyInterestPair(p.text,p.manifest,{now,products:[{id:'different'}]}));
});
test('only the exact two app-read URLs change; app, APK, product pair and course pair remain untouched',async()=>temp(async dir=>{
 const input=join(dir,'input'),site=join(dir,'site');await mkdir(site);await save(input,fixture());
 const protectedFiles=['app.js','review.apk','data/verified-products.json','data/course-catalog.json'];for(const p of protectedFiles){await mkdir(join(site,p,'..'),{recursive:true});await writeFile(join(site,p),'existing-'+p);}
 const result=await overlayInterest(site,input,{now});assert.deepEqual(result.changed.sort(),['data/catalog/shoe-interest.json','data/catalog/shoe-interest.manifest.json'].sort());assert.equal(result.nonInterestFilesUnchanged,true);for(const p of protectedFiles)assert.equal(await readFile(join(site,p),'utf8'),'existing-'+p);
 assert.throws(()=>assertInterestOnlyDelta({'app.js':'before'},{'app.js':'after'}));
}));
test('last-good retained for malformed/incomplete new data and older/conflicting timestamps',async()=>temp(async dir=>{
 const input=join(dir,'input'),site=join(dir,'site');await mkdir(site);const old=fixture();await save(join(site,'data/catalog'),old);
 for(const mutate of [d=>d.complete=false,d=>d.checkedAt='2026-10-23T06:00:00Z',d=>d.rows[0].value++]){const p=fixture();mutate(p.data);await save(input,encode(p.data));await assert.rejects(()=>overlayInterest(site,input,{now}));assert.equal(await readFile(join(site,'data/catalog/shoe-interest.json'),'utf8'),old.text);}
}));
test('actual HTTP pair required; 404, queued label, wrong hash, downgrade or config mutation cannot be success',async()=>temp(async dir=>{
 const p=fixture();await save(dir,p);const fetcher=async url=>new Response(String(url).includes('.manifest.json')?JSON.stringify(p.manifest):p.text);
 assert.equal((await verifyPublicInterest(dir,{fetcher,now})).actualPublicPairVerified,true);
 await assert.rejects(()=>verifyPublicInterest(dir,{now,fetcher:async()=>new Response('missing',{status:404})}));await assert.rejects(()=>verifyPublicInterest(dir,{now,fetcher:async()=>new Response('queued',{status:202})}));
 assertInterestPagesSource({build_type:'legacy',source:{branch:'gh-pages',path:'/'}});assert.throws(()=>assertInterestPagesSource({build_type:'workflow'}));
}));
test('workflow is serialized, bounded, data-only and verifies served bytes after existing Pages build',async()=>{
 const s=await readFile(new URL('../.github/workflows/refresh-shoe-interest.yml',import.meta.url),'utf8');assert.match(s,/--write --data-only/);assert.match(s,/shoe-interest-publication.mjs --verify-public/);assert.match(s,/group: runningbom-data-writer/);assert.match(s,/group: pages/);assert.doesNotMatch(s,/eas |play-release|preview-ota|gh pr|gh workflow run pages.yml/);
 const generator=await readFile(new URL('./refresh-shoe-interest.mjs',import.meta.url),'utf8');assert.match(generator,/!process.argv.includes\('--data-only'\)/);assert.match(generator,/shoe-interest.manifest.json/);
});
