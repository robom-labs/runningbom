// Discover, verify and publish a complete snapshot. No browser, login bypass or proxy rotation.
import { CheerioCrawler, Configuration } from '@crawlee/cheerio';
import { readFile,writeFile,mkdir,rename } from 'node:fs/promises';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { categoryLabels,classify,extractProductCandidates,mergeVerified,productSchema,sha256,releaseIsUpcoming,catalogCandidateId } from './catalog-core.mjs';
import {catalogIdentityIssue,catalogRecordKey} from './catalog-identity.mjs';
import {assessCatalogCandidate} from './catalog-refresh-guard.mjs';
import {applyReviewedMetadata} from './catalog-family-metadata.mjs';
import {approvedCatalogUrl,sameApprovedCatalogHost} from './catalog-source-policy.mjs';
import {variantAdmission} from './catalog-source-observations.mjs';
import {planCatalogSeeds,sourcePageDiagnosis,discoveredCatalogProduct,catalogRefreshPhases} from './catalog-refresh-plan.mjs';
import {checkImageOwnership,retainExactImageFrame} from './catalog-image-ownership.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const write=process.argv.includes('--write');
const max=Math.min(180,Math.max(1,Number(process.env.CATALOG_MAX_REQUESTS)||60));
const path=join(root,'data/verified-products.json');
const previousText=await readFile(path,'utf8'),previous=JSON.parse(previousText);
const previousManifest=JSON.parse(await readFile(join(root,'data/verified-products.manifest.json'),'utf8'));
if(previousManifest.sha256!==sha256(Buffer.from(previousText))||previousManifest.revision!==previous.revision||previousManifest.count!==previous.products?.length)throw new Error('Last-good catalog integrity failed; collection refused');
const sourceIds=(process.env.CATALOG_SOURCE_IDS||'').split(',').filter(Boolean);
const registry=JSON.parse(await readFile(join(root,'data/catalog-sources.json'),'utf8')).filter(s=>!sourceIds.length||sourceIds.includes(s.id));
if(!registry.length)throw new Error('No approved catalog sources selected');
const candidates=[];const checks=[];const failed=[];const quarantined=[];
const lastOriginRequest=new Map();
const permit=(url,source)=>approvedCatalogUrl(url,source);
const config=new Configuration({persistStorage:false});
const crawler=new CheerioCrawler({
 maxConcurrency:1,maxRequestsPerMinute:24,maxRequestsPerCrawl:max,maxRequestRetries:1,
 requestHandlerTimeoutSecs:45,navigationTimeoutSecs:25,respectRobotsTxtFile:true,
 useSessionPool:false,retryOnBlocked:false,
 preNavigationHooks:[async({request},options)=>{
  const origin=new URL(request.url).origin,wait=Math.max(0,(lastOriginRequest.get(origin)||0)+1000-Date.now());
  if(wait)await new Promise(resolve=>setTimeout(resolve,wait));lastOriginRequest.set(origin,Date.now());
  options.headers={'user-agent':'RunningBomCatalog/0.3 (+https://robom.kr)',accept:'text/html,application/xhtml+xml'};
 }],
 async requestHandler({request,$,enqueueLinks}){
  const source=registry.find(s=>s.id===request.userData.sourceId);
  if(!source||!permit(request.loadedUrl || request.url,source))throw new Error('source redirect outside trusted hosts');
  const rows=extractProductCandidates($,request.loadedUrl || request.url,source,{previous:previous.products});
  const diagnosis=sourcePageDiagnosis($,rows);
  checks.push({source:source.id,url:request.url,loadedUrl:request.loadedUrl||request.url,models:rows.length,...diagnosis});
  if(diagnosis.blockPage){failed.push({source:source.id,url:request.url,reason:'official origin returned blocked HTML document; no bypass attempted'});return;}
  // Reuse this SAME successful official document for feature/photo binding.
  // A cache hit never advances its actual observation date.
  const sourceHtml=$.html(),sourceSha=sha256(Buffer.from(sourceHtml)),observedAt=new Date().toISOString();
  if(Buffer.byteLength(sourceHtml)<=12_000_000){const dir=join(root,'outputs/operations/catalog-source-cache'),key=sha256(Buffer.from(request.loadedUrl||request.url));await mkdir(dir,{recursive:true});await writeFile(join(dir,key+'.html'),sourceHtml);await writeFile(join(dir,key+'.json'),JSON.stringify({url:request.loadedUrl||request.url,status:200,checkedAt:observedAt,sha256:sourceSha},null,2)+'\n');}
  for(const row of rows){
   if(catalogIdentityIssue(row)){failed.push({source:source.id,url:request.url,reason:'Gallery text rejected as product identity'});continue;}
   if(!permit(row.source,source)){failed.push({source:source.id,url:request.url,reason:'product URL not on approved HTTPS hosts'});continue;}
   if(!approvedCatalogUrl(row.imageSource,source,{image:true})){failed.push({source:source.id,url:request.url,reason:'page-declared image URL not on approved HTTPS hosts; no download attempted'});continue;}
   const imageOwner=checkImageOwnership(row);
   if(!imageOwner.ok){failed.push({source:source.id,url:row.source,sku:row.sku,reason:imageOwner.reason});continue;}
   const admission=variantAdmission(row);
   if(!admission.ok){quarantined.push({source:source.id,url:row.source,sku:row.sku,...admission});continue;}
   const [kind]=classify(row.model,row.description);
   if(!row.knownCatalogId&&kind==='unknown'&&!/running|러닝|레이싱|marathon|trail/i.test(row.model+' '+row.description))continue;
   candidates.push({...row,sourceId:source.id,imageOwnership:{...row.imageOwnership,sourceDocumentSha256:sourceSha,checkedAt:observedAt}});
  }
  if(request.userData.discovery)await enqueueLinks({
   selector:source.productSelector || 'a[href]',strategy:'same-hostname',limit:2,
   transformRequestFunction:r=> discoveredCatalogProduct(r.url,source)
    ? {...r,userData:{sourceId:source.id,discovery:false}}:false,
  });
  // Category links are taken from the actual official page, never guessed endpoints.
  if(request.userData.discovery)await enqueueLinks({selector:'a[href*="collection"], a[href*="running"]',strategy:'same-hostname',limit:2,
   transformRequestFunction:r=>permit(r.url,source)&&/\/(?:collections?|category|categories|c|w)\//i.test(new URL(r.url).pathname)&&/running|road-running|trail-running/i.test(r.url)?{...r,userData:{sourceId:source.id,discovery:true}}:false});
 },
 failedRequestHandler:async({request},error)=>failed.push({url:request.url,source:request.userData.sourceId,reason:error.message.slice(0,160)}),
},config);
// Round-robin by source prevents a large brand from starving the other brands.
// Oldest verified rows go first, so a bounded scheduled crawl rotates through all known models.
const seeds=planCatalogSeeds(registry,previous.products,max);
// Reserve request budget for links actually discovered on official category pages.
await crawler.run(seeds);
const verified=[];const seen=new Set();
for(const row of candidates){
 const key=catalogRecordKey(row);if(seen.has(key))continue;seen.add(key);
 try{
  const source=registry.find(s=>s.id===row.sourceId);
  const old=previous.products.find(p=>(p.sku&&p.sku===row.sku||row.knownCatalogId===p.id) && p.brand.toLowerCase()===row.brand.toLowerCase()&&p.sourceRegion===row.sourceRegion&&p.currency===row.currency&&sameApprovedCatalogHost(p.source,row.source,source));
  if(previous.products.some(p=>p.sku&&p.sku===row.sku&&p.brand.toLowerCase()===row.brand.toLowerCase()&&!old))throw new Error('cross-market SKU update quarantined');
  let imageSha=old?.imageSource===row.imageSource?old.imageSha256:null;
  let imageVerifiedAt=old?.imageCheckedAt||old?.checkedAt;
  const imageAge=Date.now()-Date.parse(imageVerifiedAt||'');
  if(!Number.isFinite(imageAge)||imageAge< -300000||imageAge>30*24*3600000)imageSha=null;
  let imageWidth=old?.imageWidth,imageHeight=old?.imageHeight;
  // Metadata-only operation: no image download, asset generation or license claim.
  // New models keep only the exact official-page image URL; native mappings are not changed.
  if(!imageSha){imageVerifiedAt=undefined;imageWidth=undefined;imageHeight=undefined;}
  // Neither marketing text nor a previously misclassified SKU is reviewed role evidence.
  const {category,uses}=applyReviewedMetadata(row);
  const release=row.releaseEvidence?row.release:old?.release||row.release||'';
  const p={...old,id:catalogCandidateId(row,old),brand:row.brand,model:old?.model||row.model,name:old?.name||row.model,
   source:row.source,imageSource:row.imageSource,image:old?.imageSource===row.imageSource?old.image:row.imageSource,imageSha256:imageSha,imageCheckedAt:imageVerifiedAt,imageVerification:imageSha?'original-bytes':'official-page-url',modelEn:old?.modelEn||row.modelEn||row.model,sku:row.sku,color:row.color||old?.color||'색상명 미확인',gender:row.gender==='미확인'?(old?.gender||'미확인'):row.gender,
   price:Number.isFinite(row.price)&&row.price>0?row.price:null,regularPrice:row.regularPrice||null,currency:row.currency,sourceRegion:row.sourceRegion,
   evidenceKind:row.evidenceKind,sourceSku:row.sourceSku,sourceIdentityEvidence:row.sourceIdentityEvidence,priceObservation:row.priceObservation,imageOwnership:row.imageOwnership,
   checkedAt:new Date().toISOString(),category,uses,purpose:categoryLabels[category],tier:categoryLabels[category],
   description:old?.description||'',
   plate:old?.plate||'',weight:old?.weight||'',drop:old?.drop||'',
   release,releaseSource:row.releaseEvidence?row.source:old?.release?old.releaseSource:row.release?row.source:'',releaseRegion:row.releaseRegion||old?.releaseRegion||row.sourceRegion,upcoming:release?releaseIsUpcoming(release):!!(old?.upcoming&&old?.releaseSource),
   imageWidth,imageHeight,imageRights:'source-declared-not-license-verified',
   merchant:`${source.brand} ${row.sourceRegion} 공식몰`,priceType:'공식몰 표시가 · 수집 시점'};
  const display={...applyReviewedMetadata({...p,sourceTitle:row.sourceTitle||row.model}),...(row.modelGroupEvidence?Object.fromEntries(['model','modelEn','name','modelGroup','width','widthLabel','gender','size','officialProductGroup','modelGroupEvidence'].filter(key=>row[key]!==undefined).map(key=>[key,row[key]])):{})};
  const framed=retainExactImageFrame({...display,imageOwnership:{...display.imageOwnership,recordModel:display.model,productId:display.id}});
  productSchema.parse(framed);verified.push(framed);
 }catch(e){failed.push({source:row.sourceId,url:row.source,reason:String(e.message)});}
}
const merged=mergeVerified(previous.products,verified);
const sourceHealth=registry.map(s=>{const count=verified.filter(p=>p.brand===s.brand&&p.sourceRegion===s.region).length;return {id:s.id,brand:s.brand,region:s.region,checked:checks.filter(c=>c.source===s.id).length,parsed:checks.filter(c=>c.source===s.id).reduce((n,c)=>n+c.models,0),verified:count,status:count?'verified-updates':'no-verified-update',failures:failed.filter(f=>f.source===s.id).length};});
const report={checkedAt:new Date().toISOString(),engine:'@crawlee/cheerio 3.18.2',parsed:checks.length,verified:verified.length,added:merged.added,updated:merged.updated,retained:previous.products.length,sourceHealth,failures:failed,quarantined,checks};
report.mergeSkipped=verified.length-merged.added-merged.updated;
report.noVerifiedSources=sourceHealth.filter(s=>!s.verified).map(s=>s.id);
const next={...previous,generatedAt:report.checkedAt,revision:`catalog-${sha256(Buffer.from(JSON.stringify(merged.products))).slice(0,16)}`,products:merged.products};
report.health=assessCatalogCandidate(previous,next);
report.publicationDecision=verified.length&&report.health.ok?'validated':'quarantined';
report.phases=catalogRefreshPhases(report,{write});
await mkdir(join(root,'outputs/operations'),{recursive:true});
await writeFile(join(root,'outputs/operations/catalog-refresh.json'),JSON.stringify(report,null,2)+'\n');
// Inspectable candidate, separate from the canonical LKG; never an app mirror.
const candidateText=JSON.stringify(next,null,2)+'\n',candidateDir=join(root,'outputs/operations/catalog-candidate');
await mkdir(candidateDir,{recursive:true});
await writeFile(join(candidateDir,'verified-products.json'),candidateText);
await writeFile(join(candidateDir,'verified-products.manifest.json'),JSON.stringify({schemaVersion:1,revision:next.revision,generatedAt:next.generatedAt,count:next.products.length,sha256:sha256(Buffer.from(candidateText))},null,2)+'\n');
if(!verified.length)throw new Error('No verified updates. Last good catalog retained; check source health report.');
if(!report.health.ok)throw new Error('Catalog candidate quarantined; last good catalog retained: '+report.health.errors.join(','));
if(write){
 await writeFile(path+'.tmp',JSON.stringify(next,null,2)+'\n');await rename(path+'.tmp',path);
 await import('./sync-verified-products.mjs');
}
console.log(JSON.stringify({write,verified:verified.length,added:merged.added,updated:merged.updated,failures:failed.length}));
