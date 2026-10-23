import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {assessCatalogPublicPair,assessRunHistory,boundedRead,auditDataUpdates,githubSourceText} from './audit-data-update-operations.mjs';
import {interestManifest} from './shoe-interest-publication.mjs';import {createHash} from 'node:crypto';
const now=Date.parse('2026-10-24T06:00:00Z'),at=new Date(now-3600000).toISOString(),hash=s=>createHash('sha256').update(s).digest('hex');
test('source audit supports >1 MiB Contents omissions through exact immutable bounded repository blob',()=>{
 const text='x'.repeat(1_130_880),sha='a'.repeat(40),calls=[];
 const gh=path=>{calls.push(path);return path.startsWith('contents/')?{type:'file',size:Buffer.byteLength(text),encoding:'none',sha,download_url:'https://untrusted.invalid/ignored'}:{encoding:'base64',content:Buffer.from(text).toString('base64')};};
 assert.equal(githubSourceText('data/verified-products.json',gh),text);
 assert.deepEqual(calls,['contents/data/verified-products.json?ref=main','git/blobs/'+sha]);
 assert.throws(()=>githubSourceText('bad',()=>({size:4_000_001})),/size bound/);
 assert.throws(()=>githubSourceText('bad',()=>({size:4,encoding:'base64',content:Buffer.from('x').toString('base64')})),/size mismatch/);
 assert.throws(()=>githubSourceText('bad',()=>({type:'file',size:1,encoding:'none',sha:'../../other-repo'})),/unavailable/);
});
test('a recent queued run is never a substitute for an actually completed interest success',()=>{
 const success={status:'completed',conclusion:'success',updated_at:at,html_url:'https://github.com/run/1'};
 assert.equal(assessRunHistory([success],now,30).ok,true);assert.equal(assessRunHistory([{status:'queued',updated_at:at}],now,30).ok,false);
 assert.equal(assessRunHistory([{...success,conclusion:'failure'},success],now,30).ok,false);assert.equal(assessRunHistory([{...success,updated_at:'2026-10-20T00:00:00Z'}],now,30).ok,false);
});
test('bounded reader requires HTTPS, enforces bytes, and does not retry explicit 429/403',async()=>{
 await assert.rejects(()=>boundedRead('http://insecure.test'));
 await assert.rejects(()=>boundedRead('https://example.org',{fetcher:async()=>new Response('12345'),maxBytes:4}));
 for(const status of [429,403]){let calls=0;await assert.rejects(()=>boundedRead('https://example.org',{fetcher:async()=>{calls++;return new Response('no',{status});}}));assert.equal(calls,1);}
});
test('catalog audit checks real payload hash and product age instead of snapshot timestamp only',()=>{
 const d={schemaVersion:1,revision:'catalog-test',generatedAt:at,products:[{id:'old',brand:'Example',checkedAt:'2020-01-01T00:00:00Z'}]},text=JSON.stringify(d),m={schemaVersion:1,revision:d.revision,generatedAt:at,count:1,sha256:hash(text)};
 assert.equal(assessCatalogPublicPair(text,m,now).allProductsFresh,false);assert.throws(()=>assessCatalogPublicPair(text,{...m,sha256:'0'.repeat(64)},now));
});
test('interest public pair and completed heartbeat appear separately; missing course cannot create all-healthy report',async()=>{
 const products=Array.from({length:5},(_,i)=>({id:'id-'+i,brand:'Brand',checkedAt:at}));
 const catalog=JSON.stringify({schemaVersion:1,revision:'catalog-test',generatedAt:at,products}),cm={schemaVersion:1,revision:'catalog-test',generatedAt:at,count:5,sha256:hash(catalog)};
 const interest=JSON.stringify({schemaVersion:1,checkedAt:at,source:'RunRepeat',sourceUrl:'https://runrepeat.com/catalog/running-shoes',metric:'published-page-views',complete:true,rows:products.map((p,i)=>({item_id:p.id,rank:i+1,value:100-i,evidenceUrl:'https://runrepeat.com/runner-'+i}))});
 const sources={'data/verified-products.json':catalog,'data/shoe-interest.json':interest};
 const bodies={'data/verified-products.json':catalog,'data/verified-products.manifest.json':JSON.stringify(cm),'data/catalog/shoe-interest.json':interest,'data/catalog/shoe-interest.manifest.json':JSON.stringify(interestManifest(interest))};
 const read=async url=>{const p=new URL(url).pathname.replace('/runningbom/','');if(!(p in bodies))throw Error('HTTP 404');return {text:bodies[p]};};
 const gh=()=>({workflow_runs:[{status:'completed',conclusion:'success',updated_at:at,html_url:'https://github.com/run/1'}]});
 const report=await auditDataUpdates({now,read,gh,source:p=>sources[p]});
 assert.equal(report.checks.find(c=>c.name==='interest-public-main-pair').ok,true);assert.equal(report.checks.find(c=>c.name==='interest-completed-success-heartbeat').ok,true);assert.equal(report.ok,false);assert.equal(report.readOnly,true);
});
test('audit workflow is read-only and cannot silently dispatch or publish app/binary workflows',async()=>{
 const s=await readFile(new URL('../.github/workflows/data-update-audit.yml',import.meta.url),'utf8');assert.match(s,/contents: read/);assert.match(s,/actions: read/);assert.doesNotMatch(s,/contents: write|pages: write|actions: write|git push|gh workflow run|eas |play-release/);
});
