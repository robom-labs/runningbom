import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {buildShoeFeaturePatch,extractShoeFeatureSource,productFeatureIdentity} from './shoe-features-core.mjs';
import {retainBoundEnrichment,validFeatureEvidence,validPhotoProof,attachMeasuredPhoto} from './catalog-enrichment-core.mjs';
import {runCatalogEnrichment,writeEnrichedPair,decodeOriginal} from './refresh-catalog-enrichment.mjs';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {publicCatalog,captureServerEvidence,restoreServerEvidence,assertPublicBudget,PUBLIC_CATALOG_BUDGET} from './catalog-public-evidence.mjs';
import {officialImageClient} from './catalog-image-client.mjs';import {pipelineHealth} from './check-catalog-refresh-health.mjs';import {promoteCatalogEnrichment} from './promote-catalog-enrichment.mjs';
import {reviewedFeatureDelta} from './finalize-reviewed-catalog.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),now=Date.now(),date=new Date(now).toISOString();
const p={id:'test-aero42',brand:'NIKE',model:'Aero 42',modelEn:'Aero 42',name:'Aero 42',sku:'AA4242-100',source:'https://www.nike.com/kr/t/aero-42/AA4242-100',imageSource:'https://static.nike.com/a.png',image:'https://static.nike.com/a.png',gender:'남성',sourceRegion:'한국',currency:'KRW',price:100,regularPrice:null,color:'Blue',checkedAt:date,description:'',plate:'',weight:'',drop:'',release:'',releaseRegion:'한국',releaseSource:'',upcoming:false,merchant:'NIKE',priceType:'official',imageSha256:null,category:'daily',uses:['daily'],purpose:'Daily',tier:'Daily'};
const registry=[{id:'nike-0',brand:'NIKE',region:'한국',hosts:['www.nike.com'],imageHosts:['static.nike.com']}];
const html=(product=p,image=product.imageSource)=>`<title>Nike Aero 42</title><script type="application/ld+json">${JSON.stringify({'@type':'Product',name:'Nike Aero 42 Men',brand:'NIKE',sku:product.sku,url:product.source,image,color:product.color,description:'ZoomX foam with carbon plate and breathable mesh upper.',offers:{url:product.source,price:100,priceCurrency:'KRW'}})}</script>`;
const full=product=>({...product,...buildShoeFeaturePatch(product,extractShoeFeatureSource(html(product),product,{checkedAt:date})).patch});
const catalog=products=>({schemaVersion:1,generatedAt:date,revision:'catalog-test',products});
const proof=product=>({id:product.id,sku:product.sku,brand:product.brand,model:product.model,observedModel:product.model,color:product.color,productSource:product.source,imageSource:product.imageSource,sourceUrl:product.source,identityEvidenceSha256:'a'.repeat(64),checkedAt:date});
const measurement={imageSource:p.imageSource,sha256:'b'.repeat(64),checkedAt:date,status:'bounded',bounds:{width:100,height:100,x:5,y:20,cropWidth:90,cropHeight:60,background:'#eeeeee'}};
async function temp(t){const dir=await mkdtemp(join(tmpdir(),'runningbom-enrichment-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
async function sourceCache(dir,product=p,image){await mkdir(dir,{recursive:true});const body=html(product,image),key=sha(product.source);await writeFile(join(dir,key+'.html'),body);await writeFile(join(dir,key+'.json'),JSON.stringify({url:product.source,status:200,checkedAt:date,sha256:sha(body)}));}
function pixels(){const width=100,height=100,data=Buffer.alloc(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4,c=x>15&&x<85&&y>40&&y<65?30:238;data.set([c,c,c,255],i);}return {data,width,height};}
test('locked isolated production decoder reads actual PNG originals into RGBA without altering original bytes',{skip:!existsSync(new URL('./catalog-image-tools/node_modules/sharp/package.json',import.meta.url))&&process.env.CATALOG_TOOLING_REQUIRED!=='true'?'isolated decoder is mandatory in the catalog workflow; not installed by generic root tests':false},async()=>{
 const require=createRequire(import.meta.url),sharp=require('./catalog-image-tools/node_modules/sharp'),rgba=pixels(),bytes=await sharp(rgba.data,{raw:{width:rgba.width,height:rgba.height,channels:4}}).png().toBuffer(),before=sha(bytes),decoded=await decodeOriginal(bytes);assert.equal(decoded.width,100);assert.equal(decoded.height,100);assert.equal(decoded.data.length,40000);assert.equal(sha(bytes),before);
});
test('slim public fields keep all native bindings; full audit restores only exact identity and exact published content',()=>{
 const c=catalog([full(p)]),audit=captureServerEvidence(c),slim=publicCatalog(c);assert.equal(slim.products[0].decisionEvidence.facts,undefined);assert.equal(slim.products[0].decisionEvidence.identity,undefined);assert.ok(slim.products[0].decisionEvidence.features.length);const restored=restoreServerEvidence(slim,audit);assert.deepEqual(publicCatalog(restored),slim);assert.ok(validFeatureEvidence(restored.products[0]));assert.equal(audit.featureRecords[0].decisionEvidence.facts[0].quote,undefined);assert.ok(audit.featureRecords[0].decisionEvidence.facts[0].match.length<=80);
 for(const key of ['sku','source','gender','model','width','currency']){const changed={...slim,products:[{...slim.products[0],[key]:'changed'}]};assert.equal(restoreServerEvidence(changed,audit).products[0].decisionEvidence.facts,undefined,key);}
 const changed={...slim,products:[{...slim.products[0],decisionEvidence:{...slim.products[0].decisionEvidence,headline:'unreviewed'}}]};assert.equal(restoreServerEvidence(changed,audit).products[0].decisionEvidence.facts,undefined);
 assert.throws(()=>restoreServerEvidence(slim,{...audit,featureRecords:[...audit.featureRecords,...audit.featureRecords]}),/Duplicate/);
});
test('payload budgets cap UTF-8 bytes AND characters; growth is quarantined, never reduced SKU count',()=>{
 assert.ok(assertPublicBudget(JSON.stringify(publicCatalog(catalog([full(p)])))).bytes<PUBLIC_CATALOG_BUDGET);
 assert.throws(()=>assertPublicBudget('가'.repeat(Math.ceil(PUBLIC_CATALOG_BUDGET/2))),/budget/);assert.throws(()=>assertPublicBudget('x'.repeat(PUBLIC_CATALOG_BUDGET+1)),/budget/);
});
test('future oversized candidate cannot rewrite an existing valid pair or silently remove SKUs',async t=>{
 const dir=await temp(t),c=catalog([full(p)]);await writeEnrichedPair(c,dir);const before=await readFile(join(dir,'verified-products.json'));await assert.rejects(()=>writeEnrichedPair(catalog([{...full(p),description:'가'.repeat(PUBLIC_CATALOG_BUDGET)}]),dir),/budget/);assert.deepEqual(await readFile(join(dir,'verified-products.json')),before);
});
test('identity-changed evidence is removed; unchanged stale feature LKG preserves original date, frames expire strictly',()=>{
 const good=full(p);assert.equal(validFeatureEvidence(good),true);assert.equal(retainBoundEnrichment({...good,sku:'OTHER'}).product.decisionEvidence,undefined);
 const old={...good,decisionEvidence:{...good.decisionEvidence,checkedAt:'2020-01-01T00:00:00Z'}};assert.equal(retainBoundEnrichment(old).product.decisionEvidence.checkedAt,'2020-01-01T00:00:00Z');
 const framed=attachMeasuredPhoto(p,measurement,proof(p),registry,now).product;assert.ok(framed.imageFrame);assert.equal(retainBoundEnrichment(framed,now+8*86400000).product.imageFrame,undefined);
});
test('a crop never approves a different/hashless image without exact SKU/color/product/source SHA proof',()=>{
 assert.equal(attachMeasuredPhoto(p,measurement,null,registry,now).product.imageSha256,null);
 for(const k of ['sku','color','productSource','imageSource','identityEvidenceSha256'])assert.equal(validPhotoProof(p,{...proof(p),[k]:'wrong'},registry,now),false,k);
 assert.equal(validPhotoProof(p,{...proof(p),checkedAt:'2000-01-01'},registry,now),false);
 assert.equal(validPhotoProof(p,{...proof(p),observedModel:'Nike Aero 43 Men'},registry,now),false);
 const same={...p,imageSha256:measurement.sha256};assert.equal(attachMeasuredPhoto(same,measurement,null,registry,now).status,'exact-hash-last-good-frame');
 const contained=attachMeasuredPhoto(p,{...measurement,status:'contain',bounds:null},proof(p),registry,now).product;assert.equal(contained.imageSha256,measurement.sha256);assert.equal(contained.imageFrame,undefined);
});
test('fresh observations after a slow request can approve frames, but a redirect to another model/market cannot',async t=>{
 const dir=await temp(t);let images=0;
 const opts={catalog:catalog([p]),registry,cacheDir:join(dir,'ok'),maxPages:1,maxImages:1,now:now-10*60000,featureClient:async()=>({body:html(),finalUrl:p.source}),imageClient:async()=>{images++;return {bytes:Buffer.from('fresh-source-original'),checkedAt:new Date().toISOString()};},decode:async()=>pixels()};
 const good=await runCatalogEnrichment(opts);assert.equal(images,1);assert.ok(good.catalog.products[0].imageFrame);
 const bad=await runCatalogEnrichment({...opts,cacheDir:join(dir,'bad'),featureClient:async()=>({body:html(),finalUrl:'https://www.nike.com/us/t/aero-43/AA4343-100'})});assert.equal(bad.catalog.products[0].decisionEvidence,undefined);assert.equal(bad.report.failures.length,1);assert.equal(images,1);
});
test('actual bounded runner reuses official HTML, derives source identity/features, measures only approved photos and rehashes cache',async t=>{
 const dir=await temp(t),docs=join(dir,'docs');await sourceCache(docs);let imageReads=0;
 const options={catalog:catalog([p]),registry,cacheDir:join(dir,'cache'),documentDirs:[docs],maxPages:0,maxImages:1,featureClient:async()=>{throw Error('must not fetch HTML');},imageClient:async()=>{imageReads++;return {bytes:Buffer.from('source-original'),checkedAt:date};},decode:async()=>pixels(),now};
 const first=await runCatalogEnrichment(options);assert.equal(imageReads,1);assert.ok(first.catalog.products[0].imageFrame);assert.ok(validFeatureEvidence(first.catalog.products[0]));assert.equal(first.report.sourceProofs.length,1);
 const second=await runCatalogEnrichment({...options,offline:true});assert.equal(imageReads,1);assert.equal(second.report.photos.cacheReused,1);assert.equal(second.catalog.products[0].imageFrame.checkedAt,date);
 await writeFile(join(dir,'cache/image-cache',sha(p.imageSource)+'.original'),'tampered');const third=await runCatalogEnrichment({...options,offline:true});assert.equal(third.catalog.products[0].imageFrame,undefined);assert.equal(imageReads,1);
});
test('unowned source image or expired HTML cannot cause image HTTP; failed feature sources retain exact LKG',async t=>{
 const dir=await temp(t),docs=join(dir,'docs');await sourceCache(docs,p,'https://static.nike.com/other-color.png');let images=0;
 const r=await runCatalogEnrichment({catalog:catalog([full(p)]),registry,cacheDir:join(dir,'cache'),documentDirs:[docs],maxPages:0,maxImages:1,imageClient:async()=>{images++;throw Error('not allowed');},decode:async()=>pixels(),now});assert.equal(images,0);assert.equal(r.report.sourceProofs.length,0);
 const failed=await runCatalogEnrichment({catalog:catalog([full(p)]),registry,cacheDir:join(dir,'cache2'),maxPages:1,maxImages:0,featureClient:async()=>{throw Error('403 no bypass');},now});assert.equal(failed.report.failures.length,1);assert.deepEqual(failed.catalog.products[0].decisionEvidence,full(p).decisionEvidence);
});
test('persisted actual attempts rotate blocked sources on later bounded runs instead of repeatedly starving later pages',async t=>{
 const dir=await temp(t),p2={...p,id:'second',sku:'AA4242-101',source:p.source.replace('100','101')},seen=[];const opts={catalog:catalog([p,p2]),registry,cacheDir:dir,maxPages:1,maxImages:0,featureClient:async url=>{seen.push(url);throw Error('blocked');},now};
 await runCatalogEnrichment(opts);await runCatalogEnrichment(opts);assert.equal(new Set(seen).size,2);
});
test('offline run makes zero HTTP and can hydrate full server LKG from a slim public pair',async t=>{
 const dir=await temp(t),c=catalog([full(p)]),r=await runCatalogEnrichment({catalog:publicCatalog(c),serverEvidence:captureServerEvidence(c),registry,cacheDir:dir,offline:true,featureClient:async()=>{throw Error('network forbidden');},imageClient:async()=>{throw Error('network forbidden');},now});assert.equal(r.report.network.featurePages,0);assert.equal(r.report.network.images,0);assert.equal(r.report.features.retained,1);assert.ok(validFeatureEvidence(r.catalog.products[0]));
});
test('image robots/429 restrictions never bypass or immediately retry a blocked host',async()=>{
 let calls=0;const c=officialImageClient({declared:new Set([p.imageSource]),get:async url=>{calls++;return url.endsWith('/robots.txt')?{status:200,bytes:Buffer.from('User-agent: *\nDisallow: /')}:{status:200,bytes:Buffer.alloc(0)};}});await assert.rejects(()=>c(p.imageSource),/robots-disallow/);assert.equal(calls,1);
 let wire=0;const limited=officialImageClient({declared:new Set([p.imageSource]),get:async url=>{wire++;return url.endsWith('/robots.txt')?{status:404,bytes:Buffer.alloc(0)}:{status:429,bytes:Buffer.alloc(0),retryAfter:'120'};}});await assert.rejects(()=>limited(p.imageSource),/429/);await assert.rejects(()=>limited(p.imageSource),/cooldown/);assert.equal(wire,2);
});
test('pair generation gives stripped content a unique revision and keeps full evidence server-only; promotion preserves unrelated data',async t=>{
 const dir=await temp(t),candidate=join(dir,'candidate'),target=join(dir,'data'),c=catalog([full(p)]);await writeEnrichedPair(c,target);const manifest=await writeEnrichedPair(c,candidate),text=await readFile(join(candidate,'verified-products.json'),'utf8');assert.notEqual(manifest.revision,c.revision);assert.equal(manifest.sha256,sha(text));assert.equal(JSON.parse(text).products[0].decisionEvidence.facts,undefined);assert.ok(JSON.parse(await readFile(join(candidate,'catalog-enrichment-evidence.json'))).featureRecords[0].decisionEvidence.facts);
 await writeFile(join(target,'course-catalog.json'),'COURSE64');await writeFile(join(target,'race-images.json'),'JTBC_EVENT_IDS');await promoteCatalogEnrichment(candidate,target);assert.equal(await readFile(join(target,'course-catalog.json'),'utf8'),'COURSE64');assert.equal(await readFile(join(target,'race-images.json'),'utf8'),'JTBC_EVENT_IDS');
});
test('reviewed partial delta cannot change prices/photos/family or overwrite complete evidence',()=>{
 const n=full(p);n.decisionEvidence.completeness='partial';assert.equal(reviewedFeatureDelta(catalog([p]),catalog([n])).partialAdded,1);assert.throws(()=>reviewedFeatureDelta(catalog([p]),catalog([{...n,price:200}])),/Non-feature/);assert.throws(()=>reviewedFeatureDelta(catalog([full(p)]),catalog([n])),/Only reviewed/);
});
test('phase heartbeat never equates safe partial/LKG publication with complete source or enrichment success',()=>{
 const r=pipelineHealth({publicationDecision:'validated',noVerifiedSources:['blocked'],failures:[]},{allSourcesSucceeded:false,failures:[],features:{missing:['x'],staleRetained:1},photos:{sourceApproved:1},records:2});assert.equal(r.complete,false);assert.equal(r.safeCandidateValidated,true);assert.equal(r.enrichment,'partial-failed');assert.equal(r.featureStaleLKG,1);assert.equal(pipelineHealth(null,null).complete,false);
});
test('scheduled workflow uses bounded portable phases, separate audit/main allowlist, public pair only and cache survival on failure',async()=>{
 const w=await readFile(new URL('../.github/workflows/refresh-verified-catalog.yml',import.meta.url),'utf8');assert.match(w,/refresh-verified-products\.mjs\n/);assert.match(w,/--max-pages 24 --max-images 24/);assert.match(w,/promote-catalog-enrichment/);assert.match(w,/actions\/cache\/save/);assert.match(w,/data\/catalog-enrichment-evidence\.json/);assert.match(w,/check-catalog-refresh-health/);assert.doesNotMatch(w,/\/Volumes\/|\/Users\/|apps\/mobile|expo|eas |--force|workflow run pages/);
 assert.match(w,/name: catalog-metadata-health\n\s+retention-days: 7\n/);
 const gh=w.split('SITE_BASE=')[1];assert.ok(gh);assert.doesNotMatch(gh.split('Verify actual public pair')[0],/git -C .* add -- .*catalog-enrichment-evidence/);
 const pages=await readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');assert.match(pages,/if: github.event_name == 'workflow_dispatch' && inputs.publish_app_web == true/);
 for(const name of ['preview-apk.yml','preview-ota.yml','play-release.yml']){const content=await readFile(new URL('../.github/workflows/'+name,import.meta.url),'utf8'),triggers=content.split('\non:\n')[1]?.split('\npermissions:')[0];assert.ok(triggers,name);assert.match(triggers,/^  workflow_dispatch:/m);assert.doesNotMatch(triggers,/^  (?:push|pull_request|workflow_run|repository_dispatch):/m);}
});
