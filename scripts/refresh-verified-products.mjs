// Discover, verify and publish a complete snapshot. No browser, login bypass or proxy rotation.
import { CheerioCrawler, Configuration } from '@crawlee/cheerio';
import { readFile,writeFile,mkdir,rename } from 'node:fs/promises';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { categoryLabels,classify,extractProductCandidates,fingerprint,mergeVerified,productSchema,sha256,releaseIsUpcoming } from './catalog-core.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const write=process.argv.includes('--write');const max=Number(process.env.CATALOG_MAX_REQUESTS || 180);
const path=join(root,'data/verified-products.json');
const previous=JSON.parse(await readFile(path,'utf8'));const registry=JSON.parse(await readFile(join(root,'data/catalog-sources.json'),'utf8'));
const candidates=[];const checks=[];const failed=[];
const permit=(url,source)=>{try{return source.hosts.includes(new URL(url).hostname)&&new URL(url).protocol==='https:';}catch{return false;}};
const config=new Configuration({persistStorage:false});
const crawler=new CheerioCrawler({
 maxConcurrency:3,maxRequestsPerMinute:24,maxRequestsPerCrawl:max,maxRequestRetries:1,
 requestHandlerTimeoutSecs:45,navigationTimeoutSecs:25,respectRobotsTxtFile:true,
 useSessionPool:false,retryOnBlocked:false,
 preNavigationHooks:[async({request},options)=>{options.headers={'user-agent':'RunningBomCatalog/0.3 (+https://robom.kr)',accept:'text/html,application/xhtml+xml'};}],
 async requestHandler({request,$,enqueueLinks}){
  const source=registry.find(s=>s.id===request.userData.sourceId);
  if(!source||!permit(request.loadedUrl || request.url,source))throw new Error('source redirect outside trusted hosts');
  const rows=extractProductCandidates($,request.loadedUrl || request.url,source);
  checks.push({source:source.id,url:request.url,models:rows.length,status:rows.length?'parsed':'no-structured-products'});
  for(const row of rows){
   if(!permit(row.source,source) || !permit(row.imageSource,{hosts:source.imageHosts}))continue;
   const [kind]=classify(row.model,row.description);
   if(kind==='unknown'&&!/running|러닝|레이싱|marathon|trail/i.test(row.model+' '+row.description))continue;
   const old=previous.products.find(p=>p.sku && p.sku===row.sku && p.brand.toLowerCase()===row.brand.toLowerCase());
   if(old){row.model=old.model;row.modelEn=old.modelEn;}
   candidates.push({...row,sourceId:source.id});
  }
  if(request.userData.discovery)await enqueueLinks({
   selector:source.productSelector || 'a[href]',strategy:'same-hostname',
   transformRequestFunction:r=> permit(r.url,source) && new RegExp(source.productPattern).test(new URL(r.url).pathname)
    ? {...r,userData:{sourceId:source.id,discovery:false}}:false,
  });
  // Category links are taken from the actual official page, never guessed endpoints.
  if(request.userData.discovery)await enqueueLinks({selector:'a[href*="collection"], a[href*="running"]',strategy:'same-hostname',limit:2,
   transformRequestFunction:r=>permit(r.url,source)&&/running|road-running|trail-running/i.test(r.url)?{...r,userData:{sourceId:source.id,discovery:true}}:false});
 },
 failedRequestHandler:async({request},error)=>failed.push({url:request.url,source:request.userData.sourceId,reason:error.message.slice(0,160)}),
},config);
// Round-robin by source prevents a large brand from starving the other brands.
// Oldest verified rows go first, so a bounded scheduled crawl rotates through all known models.
const queues=registry.map(s=>[...s.collections.map(url=>({url,userData:{sourceId:s.id,discovery:true}})),
 ...previous.products.filter(p=>s.brand.toLowerCase()===p.brand.toLowerCase()&&s.region===p.sourceRegion&&s.hosts.includes(new URL(p.source).hostname)).sort((a,b)=>Date.parse(a.checkedAt)-Date.parse(b.checkedAt)).map((p,i)=>({url:p.source,userData:{sourceId:s.id,discovery:i<1}}))]);
const seeds=[];for(let i=0;queues.some(q=>q[i]);i++)for(const q of queues)if(q[i])seeds.push(q[i]);
await crawler.run(seeds);
const verified=[];const seen=new Set();
for(const row of candidates){
 const key=row.sku || fingerprint(row);if(seen.has(key))continue;seen.add(key);
 try{
  const source=registry.find(s=>s.id===row.sourceId);
  const old=previous.products.find(p=>p.sku===row.sku && p.brand.toLowerCase()===row.brand.toLowerCase());
  let imageSha=old?.imageSource===row.imageSource?old.imageSha256:null;
  let imageVerifiedAt=old?.imageCheckedAt||old?.checkedAt;
  if(!imageSha){
   const response=await fetch(row.imageSource,{signal:AbortSignal.timeout(15000),redirect:'error',headers:{accept:'image/jpeg,image/png,image/webp,image/avif'}});
   if(!response.ok||!/^image\/(jpeg|png|webp|avif)/.test(response.headers.get('content-type')||''))throw new Error('original image HTTP '+response.status);
   const size=Number(response.headers.get('content-length')||0);if(size>12_000_000)throw new Error('image too large');
   const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length<500||bytes.length>12_000_000)throw new Error('image size invalid');
   imageSha=sha256(bytes);imageVerifiedAt=new Date().toISOString();
  }
  const [category,uses]=old?[old.category,old.uses]:classify(row.model,row.description);
  const identity=sha256(Buffer.from(fingerprint(row))).slice(0,12);
  const release=old?.release||row.release||'';
  const p={...old,id:old?.id||'shoe-'+identity,brand:row.brand,model:row.model,name:old?.name||row.model,
   source:row.source,imageSource:row.imageSource,image:old?.imageSource===row.imageSource?old.image:row.imageSource,imageSha256:imageSha,imageCheckedAt:imageVerifiedAt,imageVerification:'original-bytes',modelEn:old?.modelEn||row.modelEn||row.model,sku:row.sku,color:row.color||'색상명 미확인',gender:row.gender==='미확인'?(old?.gender||'미확인'):row.gender,
   price:Number.isFinite(row.price)&&row.price>0?row.price:null,regularPrice:row.regularPrice||null,currency:row.currency,sourceRegion:row.sourceRegion,
   checkedAt:new Date().toISOString(),category,uses,purpose:categoryLabels[category],tier:categoryLabels[category],
   description:old?.description||'',
   plate:old?.plate||'',weight:old?.weight||'',drop:old?.drop||'',
   release,releaseSource:old?.release?old.releaseSource:row.release?row.source:'',releaseRegion:old?.releaseRegion||row.sourceRegion,upcoming:release?releaseIsUpcoming(release):!!(old?.upcoming&&old?.releaseSource),
   merchant:`${source.brand} ${row.sourceRegion} 공식몰`,priceType:'공식몰 표시가 · 수집 시점'};
  productSchema.parse(p);verified.push(p);
 }catch(e){failed.push({source:row.sourceId,url:row.source,reason:String(e.message)});}
}
const merged=mergeVerified(previous.products,verified);
const sourceHealth=registry.map(s=>({id:s.id,brand:s.brand,region:s.region,checked:checks.filter(c=>c.source===s.id).length,parsed:checks.filter(c=>c.source===s.id).reduce((n,c)=>n+c.models,0),verified:verified.filter(p=>p.brand===s.brand&&p.sourceRegion===s.region).length,failures:failed.filter(f=>f.source===s.id).length}));
const report={checkedAt:new Date().toISOString(),engine:'@crawlee/cheerio 3.18.2',parsed:checks.length,verified:verified.length,added:merged.added,updated:merged.updated,retained:previous.products.length,sourceHealth,failures:failed,checks};
await mkdir(join(root,'outputs/operations'),{recursive:true});
await writeFile(join(root,'outputs/operations/catalog-refresh.json'),JSON.stringify(report,null,2)+'\n');
if(!verified.length)throw new Error('No verified updates. Last good catalog retained; check source health report.');
if(write){
 const next={...previous,generatedAt:report.checkedAt,revision:`catalog-${sha256(Buffer.from(JSON.stringify(merged.products))).slice(0,16)}`,products:merged.products};
 await writeFile(path+'.tmp',JSON.stringify(next,null,2)+'\n');await rename(path+'.tmp',path);
 await import('./sync-verified-products.mjs');
}
console.log(JSON.stringify({write,verified:verified.length,added:merged.added,updated:merged.updated,failures:failed.length}));
