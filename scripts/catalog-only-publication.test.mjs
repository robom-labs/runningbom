import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {sha256} from './catalog-core.mjs';
import {verifyCatalogPair,assertCatalogOnlyDelta,overlayCatalog,treeHashes,verifyPublicPair,assertPagesSource} from './catalog-only-publication.mjs';
import {verifyCatalogManifest,syncCatalogManifest} from './sync-verified-products.mjs';
const now=Date.parse('2026-10-22T12:00:00Z');
const seed=JSON.parse(await readFile(new URL('../data/verified-products.json',import.meta.url),'utf8'));
function pair(patch={}){const data={...seed,generatedAt:new Date(now).toISOString(),products:[{...seed.products[0],checkedAt:new Date(now-1000).toISOString()}],...patch};const text=JSON.stringify(data);return {text,manifest:{schemaVersion:1,revision:data.revision,generatedAt:data.generatedAt,sha256:sha256(Buffer.from(text)),count:data.products.length}};}
test('catalog:check accepts manifest property order, whitespace and compatible metadata without rewriting either file',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'catalog-semantic-check-'));try{
  const p=pair(),manifestText=JSON.stringify({...Object.fromEntries(Object.entries(p.manifest).reverse()),sizeBytes:Buffer.byteLength(p.text)},null,4)+'\n\n';
  await writeFile(join(dir,'verified-products.json'),p.text);await writeFile(join(dir,'verified-products.manifest.json'),manifestText);
  assert.equal((await syncCatalogManifest(dir,{check:true,now})).count,1);
  assert.equal(await readFile(join(dir,'verified-products.json'),'utf8'),p.text);assert.equal(await readFile(join(dir,'verified-products.manifest.json'),'utf8'),manifestText);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('catalog:check refuses real manifest identity/hash/schema errors and payload whitespace changes',()=>{
 const p=pair();for(const patch of [{sha256:'0'.repeat(64)},{count:2},{revision:'other'},{generatedAt:new Date(now-1000).toISOString()},{schemaVersion:2},{count:'1'},{sha256:'A'.repeat(64)}])assert.throws(()=>verifyCatalogManifest(p.text,{...p.manifest,...patch},now));
 assert.throws(()=>verifyCatalogManifest(p.text+'\n',p.manifest,now),/Invalid/);
 const duplicate=pair({products:[seed.products[0],seed.products[0]]});assert.throws(()=>verifyCatalogManifest(duplicate.text,duplicate.manifest,now),/Duplicate/);
});
test('catalog:check retains strict timestamp and freshness gates instead of waiving publication failures',()=>{
 const stale=pair({generatedAt:'2020-01-01T00:00:00Z',products:[{...seed.products[0],checkedAt:'2020-01-01T00:00:00Z'}]});assert.throws(()=>verifyCatalogManifest(stale.text,stale.manifest,now),/fresh/);
 const future=pair({generatedAt:new Date(now+1000).toISOString()});assert.throws(()=>verifyCatalogManifest(future.text,future.manifest,now),/timestamp/);
 const invalid=pair({generatedAt:'October 22, 2026'});assert.throws(()=>verifyCatalogManifest(invalid.text,invalid.manifest,now));
});
test('catalog pair requires integrity and fresh per-product evidence, not just a fresh envelope',()=>{
 const p=pair();assert.equal(verifyCatalogPair(p.text,p.manifest,now).freshProducts,1);
 assert.throws(()=>verifyCatalogPair(p.text,{...p.manifest,sha256:'0'.repeat(64)},now),/Invalid/);
 const stale=pair({products:[{...seed.products[0],checkedAt:'2020-01-01T00:00:00Z'}]});assert.throws(()=>verifyCatalogPair(stale.text,stale.manifest,now),/fresh/);
 const duplicate=pair({products:[seed.products[0],seed.products[0]]});assert.throws(()=>verifyCatalogPair(duplicate.text,duplicate.manifest,now),/Duplicate/);
});
test('all non-catalog changes and deletions are refused',()=>{
 assert.deepEqual(assertCatalogOnlyDelta({'app.js':'a'},{'app.js':'a','data/verified-products.json':'b'}),['data/verified-products.json']);
 for(const after of [{'app.js':'b'},{},{'app.js':'a','assets/new.jpg':'b'},{'app.js':'a','data/races.json':'b'}])assert.throws(()=>assertCatalogOnlyDelta({'app.js':'a'},after),/Non-catalog/);
});
test('Pages guard permits only existing legacy gh-pages root configuration',()=>{
 assert.doesNotThrow(()=>assertPagesSource({build_type:'legacy',source:{branch:'gh-pages',path:'/'}}));
 for(const config of [null,{}, {build_type:'workflow',source:{branch:'gh-pages',path:'/'}},{build_type:'legacy',source:{branch:'main',path:'/'}},{build_type:'legacy',source:{branch:'gh-pages',path:'/docs'}}])assert.throws(()=>assertPagesSource(config),/Pages must remain/);
});
test('public verification rejects 404 and another revision instead of equating a push with publication',async()=>{
 const root=await mkdtemp(join(tmpdir(),'catalog-public-'));
 try{
  const p=pair({generatedAt:new Date().toISOString(),products:[{...seed.products[0],checkedAt:new Date().toISOString()}]});
  await writeFile(join(root,'verified-products.manifest.json'),JSON.stringify(p.manifest));
  await assert.rejects(verifyPublicPair('https://example.com/',root,async()=>new Response('',{status:404})),/unavailable/);
  const fetcher=async url=>new Response(String(url).endsWith('.manifest.json')?JSON.stringify(p.manifest):p.text);
  assert.equal((await verifyPublicPair('https://example.com/',root,fetcher)).revision,p.manifest.revision);
  await writeFile(join(root,'verified-products.manifest.json'),JSON.stringify({...p.manifest,revision:'different'}));
  await assert.rejects(verifyPublicPair('https://example.com/',root,fetcher),/candidate revision/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('missing initial catalog baseline is allowed and app/race/assets remain byte-identical',async()=>{
 const root=await mkdtemp(join(tmpdir(),'catalog-publish-'));
 try{const site=join(root,'site'),data=join(root,'input');await mkdir(join(site,'data'),{recursive:true});await mkdir(join(site,'assets'));await mkdir(data);
  await writeFile(join(site,'app.js'),'immutable app');await writeFile(join(site,'assets/existing.jpg'),'existing bytes');await writeFile(join(site,'data/races.json'),'unchanged');
  const p=pair();await writeFile(join(data,'verified-products.json'),p.text);await writeFile(join(data,'verified-products.manifest.json'),JSON.stringify(p.manifest));
  const before=await treeHashes(site),report=await overlayCatalog(site,data,now),after=await treeHashes(site);
  assert.equal(report.nonCatalogFilesUnchanged,true);assert.equal(report.changed.length,2);for(const path of Object.keys(before))assert.equal(after[path],before[path]);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('existing pair integrity, generatedAt downgrade and >40% count loss are checked before any writes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'catalog-baseline-'));
 const site=join(root,'site'),input=join(root,'input');await mkdir(join(site,'data'),{recursive:true});await mkdir(input);
 const rows=seed.products.slice(0,10).map(p=>({...p,checkedAt:new Date(now-1000).toISOString()}));
 const old=pair({products:rows,generatedAt:new Date(now-1000).toISOString()});
 const writePair=async(dir,p)=>{await writeFile(join(dir,'verified-products.json'),p.text);await writeFile(join(dir,'verified-products.manifest.json'),JSON.stringify(p.manifest));};
 try{
  await writePair(join(site,'data'),old);const unchanged=await treeHashes(site);
  const downgrade=pair({products:rows,generatedAt:new Date(now-2000).toISOString()});await writePair(input,downgrade);
  await assert.rejects(overlayCatalog(site,input,now),/downgrade/);assert.deepEqual(await treeHashes(site),unchanged);
  await writePair(input,pair({products:rows.slice(0,5)}));await assert.rejects(overlayCatalog(site,input,now),/40%/);assert.deepEqual(await treeHashes(site),unchanged);
  await writePair(input,pair({products:rows}));await writeFile(join(site,'data/verified-products.manifest.json'),JSON.stringify({...old.manifest,sha256:'0'.repeat(64)}));
  const corrupt=await treeHashes(site);await assert.rejects(overlayCatalog(site,input,now),/Invalid/);assert.deepEqual(await treeHashes(site),corrupt);
  await rm(join(site,'data/verified-products.manifest.json'));const incomplete=await treeHashes(site);await assert.rejects(overlayCatalog(site,input,now),/incomplete/);assert.deepEqual(await treeHashes(site),incomplete);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('exact 40% count reduction is allowed and partial historical rows retain their actual checkedAt',async()=>{
 const root=await mkdtemp(join(tmpdir(),'catalog-partial-'));const site=join(root,'site'),input=join(root,'input');await mkdir(join(site,'data'),{recursive:true});await mkdir(input);
 const rows=seed.products.slice(0,10).map(p=>({...p,checkedAt:'2026-10-01T00:00:00Z'}));
 const old=pair({products:rows,generatedAt:'2026-10-01T00:00:00Z'}),retained=rows.slice(0,6);retained[0]={...retained[0],checkedAt:new Date(now-1000).toISOString()};
 const candidate=pair({products:retained});const writePair=async(dir,p)=>{await writeFile(join(dir,'verified-products.json'),p.text);await writeFile(join(dir,'verified-products.manifest.json'),JSON.stringify(p.manifest));};
 try{await writePair(join(site,'data'),old);await writePair(input,candidate);const report=await overlayCatalog(site,input,now);assert.equal(report.count,6);assert.equal(report.freshProducts,1);assert.equal(report.retainedHistorical,5);
  const published=JSON.parse(await readFile(join(site,'data/verified-products.json'),'utf8'));assert.deepEqual(published.products,retained);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('pipeline cannot publish broad app/image changes, mutate Pages settings or call pages.yml',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/refresh-verified-catalog.yml',import.meta.url),'utf8');
 assert.match(workflow,/CATALOG_PUBLISH_ENABLED == 'true'/);assert.match(workflow,/default: false/);
 assert.match(workflow,/git push origin HEAD:main/);assert.match(workflow,/HEAD:gh-pages/);assert.doesNotMatch(workflow,/--force|workflow run pages|expo|images:refresh|apps\/mobile/);
 assert.match(workflow,/pages\/builds/);assert.match(workflow,/--verify-public/);
 assert.match(workflow,/concurrency:\n  group: runningbom-data-writer\n  cancel-in-progress: false/);
 assert.match(workflow,/catalog:\n    concurrency:\n      group: pages\n      cancel-in-progress: false/);
 const buildAt=workflow.indexOf('gh api --method POST');assert.ok(workflow.lastIndexOf('--assert-pages',buildAt)>workflow.indexOf('HEAD:gh-pages'));
 const crawler=await readFile(new URL('./refresh-verified-products.mjs',import.meta.url),'utf8');
 assert.match(crawler,/respectRobotsTxtFile:true/);assert.match(crawler,/retryOnBlocked:false/);assert.match(crawler,/useSessionPool:false/);assert.doesNotMatch(crawler,/await fetch\(row.imageSource/);
 const sync=await readFile(new URL('./sync-verified-products.mjs',import.meta.url),'utf8');assert.doesNotMatch(sync,/apps\/mobile|outputs\/pushrun-site/);
 assert.match(crawler,/planCatalogSeeds\(registry,previous.products,max\)/);
 const plan=await readFile(new URL('./catalog-refresh-plan.mjs',import.meta.url),'utf8');
 assert.match(plan,/Math.max\(Math.min\(active,max\),Math.floor\(max\*\.6\)\)\)/);
 assert.match(crawler,/noVerifiedSources/);assert.match(crawler,/mergeSkipped/);
 assert.ok(crawler.indexOf("if(!verified.length)throw")<crawler.indexOf('if(write){'));
});
test('race and catalog main writers share the same non-cancelling workflow-level mutex',async()=>{
 const groups=[];
 for(const name of ['refresh-race-data.yml','refresh-verified-catalog.yml']){
  const workflow=await readFile(new URL('../.github/workflows/'+name,import.meta.url),'utf8');
  const global=workflow.match(/^concurrency:\n  group: ([^\n]+)\n  cancel-in-progress: (false)\n/m);
  assert(global,`${name} must have a non-cancelling global writer mutex`);
  groups.push(global[1]);
 }
 assert.deepEqual(groups,['runningbom-data-writer','runningbom-data-writer']);
});
test('CI, Pages and daily automation install root lock before root tests without replacing mobile installation',async()=>{
 for(const name of ['ci.yml','pages.yml','daily-self-improve.yml']){
  const workflow=await readFile(new URL('../.github/workflows/'+name,import.meta.url),'utf8');
  if(name==='daily-self-improve.yml'){
   const install=workflow.indexOf('run: npm ci --ignore-scripts --no-audit --no-fund'),action=workflow.indexOf('uses: anthropics/claude-code-action@');
   assert(install>=0&&action>install);assert(workflow.indexOf('npm test',action)>action);assert.match(workflow,/run: npm --prefix apps\/mobile ci/);continue;
  }
  const verify=workflow.split('  verify:\n')[1]?.split('\n  deploy:')[0];assert(verify,`${name} verify job missing`);
  const install=verify.indexOf('run: npm ci --ignore-scripts --no-audit --no-fund');
  const testAt=verify.indexOf('run: npm test');assert(install>=0&&testAt>install,`${name} must install root lock before tests`);
  assert.match(verify,/run: npm --prefix apps\/mobile ci/);assert.match(verify,/run: npm run audit:prod/);
  if(name==='pages.yml'){assert.match(workflow,/default: false/);assert.match(workflow,/if: github.event_name == 'workflow_dispatch' && inputs.publish_app_web == true/);}
 }
});
