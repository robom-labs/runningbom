// Portable scheduled phase: candidate in/out only, no apps or public sidecars.
// Exact identity-bound LKG survives failures without advancing source dates.
import {readFile,writeFile,mkdir,readdir,rename,stat,unlink} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
import {load} from 'cheerio';
import {extractProductCandidates,sha256,productSchema} from './catalog-core.mjs';
import {verifyCatalogPair} from './catalog-only-publication.mjs';
import {exactPhotoAssociation} from './catalog-photo-source-audit.mjs';
import {shoeFeaturePageKey,prepareShoeFeatureDocument,extractShoeFeatureSource,buildShoeFeaturePatch,shoeFeatureModelKey} from './shoe-features-core.mjs';
import {officialFeatureClient,boundedOfficialGet} from './shoe-features-fetch.mjs';
import {officialImageClient,boundedImageRequest} from './catalog-image-client.mjs';
import {analyzeProductFrame} from './product-frame-audit-core.mjs';
import {withinTTL,productSourceRegistry,validFeatureEvidence,validPhotoProof,retainBoundEnrichment,attachMeasuredPhoto} from './catalog-enrichment-core.mjs';
import {publicCatalog,captureServerEvidence,restoreServerEvidence,assertPublicBudget} from './catalog-public-evidence.mjs';
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const writeJSON=async(path,data)=>{await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(data,null,2)+'\n');};
const toolingRequire=createRequire(import.meta.url);let bitmapDecoder;
export async function decodeOriginal(bytes){bitmapDecoder??=toolingRequire(process.env.PHOTO_FRAME_SHARP_MODULE||'./catalog-image-tools/node_modules/sharp');const r=await bitmapDecoder(bytes,{limitInputPixels:16000000,animated:false}).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data:r.data,width:r.info.width,height:r.info.height};}
async function pruneCache(dir,now){
 const rows=[];for(const f of (await readdir(dir)).filter(f=>/^[a-f0-9]{64}\.json$/.test(f)).slice(0,2000))try{const m=await json(join(dir,f));rows.push({f,time:Date.parse(m.checkedAt)||0,keep:withinTTL(m.checkedAt,now)});}catch{}
 rows.sort((a,b)=>b.time-a.time);for(const r of rows.filter((r,i)=>!r.keep||i>=512))for(const suffix of ['.json','.html','.original'])await unlink(join(dir,r.f.replace(/\.json$/,suffix))).catch(()=>{});
}
export async function runCatalogEnrichment({catalog,registry,cacheDir,documentDirs=[],serverEvidence,offline=false,maxPages=24,maxImages=24,featureClient,imageClient,decode,now=Date.now()}){
 catalog=restoreServerEvidence(catalog,serverEvidence);
 if(!Array.isArray(catalog.products)||!catalog.products.length||catalog.products.length>2000||new Set(catalog.products.map(p=>p.id)).size!==catalog.products.length)throw Error('Invalid catalog identity grain');
 maxPages=Math.min(60,Math.max(0,Math.floor(maxPages)));maxImages=Math.min(60,Math.max(0,Math.floor(maxImages)));if(!Number.isFinite(maxPages)||!Number.isFinite(maxImages))throw Error('Invalid enrichment budget');
 const sourceCache=join(cacheDir,'source-cache'),imageCache=join(cacheDir,'image-cache');await mkdir(sourceCache,{recursive:true});await mkdir(imageCache,{recursive:true});
 await pruneCache(sourceCache,now);await pruneCache(imageCache,now);
 const report={schemaVersion:1,checkedAt:new Date(now).toISOString(),offline,network:{featurePages:0,images:0,featureHTTP:0,imageHTTP:0,maxPages,maxImages,maxFeatureHTTP:96,maxImageHTTP:64,retries:0},documents:[],failures:[],features:{applied:0,retained:0,staleRetained:0,invalidRemoved:[],missing:[]},photos:{measured:0,cacheReused:0,invalidRemoved:[],statuses:{}},sourceProofs:[],allSourcesSucceeded:false};
 let products=catalog.products.map(p=>{const r=retainBoundEnrichment(p,now);if(r.removedFeature)report.features.invalidRemoved.push(p.id);if(r.removedFrame)report.photos.invalidRemoved.push(p.id);return r.product;});
 const byPage=new Map();for(const p of products)if(productSourceRegistry(p,registry)){const key=shoeFeaturePageKey(p.source);if(!byPage.has(key))byPage.set(key,[]);byPage.get(key).push(p);}
 const docs=new Map();
 for(const dir of [...documentDirs,sourceCache])for(const f of (await readdir(dir).catch(()=>[])).filter(f=>/^[a-f0-9]{64}\.json$/.test(f)).slice(0,512)){
  try{if((await stat(join(dir,f))).size>64000)throw Error('Document cache metadata cap');const meta=await json(join(dir,f));if(meta.status!==200||!meta.url||!withinTTL(meta.checkedAt,now))continue;const bodyPath=join(dir,f.replace(/\.json$/,'.html'));if((await stat(bodyPath)).size>12_000_000)throw Error('Document cache body cap');const body=await readFile(bodyPath);if(sha256(body)!==meta.sha256)throw Error('Document cache SHA mismatch');const key=shoeFeaturePageKey(meta.url);if(!byPage.has(key))continue;if(!docs.has(key)||Date.parse(docs.get(key).meta.checkedAt)<Date.parse(meta.checkedAt))docs.set(key,{meta,body:body.toString('utf8')});if(resolve(dir)!==resolve(sourceCache)){const cacheKey=sha256(Buffer.from(meta.url));await writeFile(join(sourceCache,cacheKey+'.html'),body);await writeJSON(join(sourceCache,cacheKey+'.json'),meta);}}
  catch(e){report.failures.push({phase:'document-cache',file:f,reason:e.message});}
 }
 let featureState={};try{featureState=await json(join(cacheDir,'feature-network.json'));}catch{}
 const allowedHosts=new Set();for(const p of products)if(productSourceRegistry(p,registry))allowedHosts.add(new URL(p.source).hostname);for(const key of byPage.keys())allowedHosts.add(new URL(key).hostname);
 const readFeature=featureClient||officialFeatureClient({allowedHosts,state:featureState,get:async(...args)=>{if(report.network.featureHTTP>=96)throw Error('Feature HTTP budget');report.network.featureHTTP++;return boundedOfficialGet(...args);},onState:s=>writeJSON(join(cacheDir,'feature-network.json'),s)});
 let attempts={};try{attempts=await json(join(cacheDir,'feature-attempts.json'));}catch{}
 // Oldest/missing feature proof rotates first; cache hits do not consume budget.
 const planned=[...byPage].sort((a,b)=>(Date.parse(attempts[a[0]]?.attemptedAt)||0)-(Date.parse(attempts[b[0]]?.attemptedAt)||0)||Math.min(...a[1].map(p=>Date.parse(p.decisionEvidence?.checkedAt)||0))-Math.min(...b[1].map(p=>Date.parse(p.decisionEvidence?.checkedAt)||0)));
 if(!offline)for(const [url]of planned){if(docs.has(url)||report.network.featurePages>=maxPages)continue;
  report.network.featurePages++;attempts[url]={attemptedAt:new Date().toISOString()};try{const response=await readFeature(url);if(shoeFeaturePageKey(response.finalUrl||url)!==shoeFeaturePageKey(url))throw Error('Redirect changed exact approved product/market path');const body=response.body,meta={url,loadedUrl:response.finalUrl||url,status:200,checkedAt:new Date().toISOString(),sha256:sha256(Buffer.from(body))};docs.set(url,{meta,body});const key=sha256(Buffer.from(url));await writeFile(join(sourceCache,key+'.html'),body);await writeJSON(join(sourceCache,key+'.json'),meta);}catch(e){attempts[url].failure=e.message;report.failures.push({phase:'feature-read',url,reason:e.message});}finally{await writeJSON(join(cacheDir,'feature-attempts.json'),attempts);}
 }
 now=Math.max(now,Date.now());
 const patches=new Map(),proofs=new Map((serverEvidence?.photoProofs||[]).map(e=>[e.id,e]));
 for(const [key,{meta,body}]of docs){const items=byPage.get(key)||[];if(!items.length)continue;const prepared=prepareShoeFeatureDocument(body),source=productSourceRegistry(items[0],registry);if(!source)continue;
  report.documents.push({url:meta.url,sha256:meta.sha256,checkedAt:meta.checkedAt});
  const rows=extractProductCandidates(load(body),meta.loadedUrl||meta.url,source,{previous:products});
  for(const row of rows){const p=products.find(p=>p.id===row.knownCatalogId);if(!p||!exactPhotoAssociation(p,row))continue;proofs.set(p.id,{id:p.id,sku:p.sku,brand:p.brand,model:p.model,observedModel:row.sourceTitle||row.model,color:p.color,productSource:p.source,imageSource:p.imageSource,sourceUrl:meta.loadedUrl||meta.url,identityEvidenceSha256:meta.sha256,checkedAt:meta.checkedAt});}
  for(const p of items){const source=extractShoeFeatureSource(body,p,{source:meta.url,checkedAt:meta.checkedAt,prepared}),patch=buildShoeFeaturePatch(p,source);if(patch.ok&&validFeatureEvidence({...p,...patch.patch}))patches.set(p.id,patch.patch);}
 }
 products=products.map(p=>{const patch=patches.get(p.id);if(patch){report.features.applied++;return {...p,...patch};}if(validFeatureEvidence(p)){report.features.retained++;if(!withinTTL(p.decisionEvidence.checkedAt,now))report.features.staleRetained++;}else report.features.missing.push(p.id);return p;});
 report.sourceProofs=[...proofs.values()];
 const urls=new Map();for(const p of products)if(validPhotoProof(p,proofs.get(p.id),registry,now)){if(!urls.has(p.imageSource))urls.set(p.imageSource,[]);urls.get(p.imageSource).push(p);}
 let imageState={};try{imageState=await json(join(cacheDir,'image-network.json'));}catch{}
 const getImage=imageClient||officialImageClient({declared:new Set(urls.keys()),state:imageState,get:async(...args)=>{if(report.network.imageHTTP>=64)throw Error('Image HTTP budget');report.network.imageHTTP++;return boundedImageRequest(...args);},onState:s=>writeJSON(join(cacheDir,'image-network.json'),s)}),measurements=new Map();
 for(const [url,items]of [...urls].sort((a,b)=>Math.min(...a[1].map(p=>Date.parse(p.imageFrame?.checkedAt)||0))-Math.min(...b[1].map(p=>Date.parse(p.imageFrame?.checkedAt)||0)))){
  const key=sha256(Buffer.from(url));let measurement,bytes;
  try{const meta=await json(join(imageCache,key+'.json'));if(meta.imageSource!==url||!withinTTL(meta.checkedAt,now))throw Error('Expired image cache');const bytePath=join(imageCache,key+'.original');if((await stat(bytePath)).size>10*1024*1024)throw Error('Image cache body cap');bytes=await readFile(bytePath);if(sha256(bytes)!==meta.sha256)throw Error('Image cache SHA mismatch');measurement=meta;report.photos.cacheReused++;}catch{}
  if(!measurement&&items.every(p=>p.imageFrame&&withinTTL(p.imageFrame.checkedAt,now)))continue;
  if(!measurement&&!offline&&report.network.images<maxImages){
   report.network.images++;try{const r=await getImage(url);bytes=r.bytes;if(bytes.length>10*1024*1024)throw Error('Image body cap');const decoded=await decode(bytes),analysis=analyzeProductFrame(decoded);measurement={imageSource:url,sha256:sha256(bytes),checkedAt:r.checkedAt||new Date().toISOString(),...analysis};await writeFile(join(imageCache,key+'.original'),bytes);await writeJSON(join(imageCache,key+'.json'),measurement);report.photos.measured++;}catch(e){report.failures.push({phase:'image-read',url,reason:e.message});}
  }
  if(measurement)measurements.set(url,measurement);
 }
 now=Math.max(now,Date.now());products=products.map(p=>{const result=attachMeasuredPhoto(p,measurements.get(p.imageSource),proofs.get(p.id),registry,now);report.photos.statuses[result.status]=(report.photos.statuses[result.status]||0)+1;return result.product;});
 const enriched={...catalog,products},groups=Map.groupBy(products,shoeFeatureModelKey);
 report.features.completeRecords=products.filter(p=>validFeatureEvidence(p)&&p.decisionEvidence.completeness!=='partial').length;report.features.partialRecords=products.filter(p=>validFeatureEvidence(p)&&p.decisionEvidence.completeness==='partial').length;report.features.modelGroups=groups.size;report.photos.attached=products.filter(p=>p.imageFrame).length;report.photos.sourceApproved=products.filter(p=>validPhotoProof(p,proofs.get(p.id),registry,now)).length;report.records=products.length;report.allSourcesSucceeded=!report.failures.length&&!report.features.missing.length&&report.photos.sourceApproved===products.length;
 return {catalog:enriched,report};
}
export async function writeEnrichedPair(catalog,out,{photoProofs=[]}={}){
 const fullFeatureRecords=catalog.products.filter(p=>p.decisionEvidence).map(p=>({id:p.id,decisionEvidence:p.decisionEvidence})),serverEvidence=captureServerEvidence(catalog,photoProofs);catalog=publicCatalog(catalog);
 const products=catalog.products;for(const p of products)productSchema.parse(p);
 const next={...catalog,generatedAt:new Date().toISOString(),revision:'catalog-'+sha256(Buffer.from(JSON.stringify(products))).slice(0,16)},text=JSON.stringify(next,null,2)+'\n',manifest={schemaVersion:1,revision:next.revision,generatedAt:next.generatedAt,count:products.length,sha256:sha256(Buffer.from(text))};verifyCatalogPair(text,manifest);
 assertPublicBudget(text);
 const auditFull={schemaVersion:1,generatedAt:next.generatedAt,publicRevision:next.revision,featureRecords:fullFeatureRecords,photoProofs};
 const files=[['verified-products.json',text],['verified-products.manifest.json',JSON.stringify(manifest,null,2)+'\n'],['catalog-enrichment-evidence.json',JSON.stringify(serverEvidence,null,2)+'\n']];
 await mkdir(out,{recursive:true});for(const [file,data]of files)await writeFile(join(out,file+'.tmp'),data);for(const [file]of files)await rename(join(out,file+'.tmp'),join(out,file));await writeFile(join(out,'feature-evidence-full.json'),JSON.stringify(auditFull,null,2)+'\n');return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2),get=(k,f)=>{const i=args.indexOf(k);return i<0?f:args[i+1];};
 const input=resolve(get('--input',join(root,'outputs/operations/catalog-candidate/verified-products.json'))),out=resolve(get('--out',join(root,'outputs/operations/catalog-enriched'))),cacheDir=resolve(get('--cache-dir',join(root,'outputs/operations/catalog-enrichment-cache')));
 if(out===dirname(input)||/[/\\]apps[/\\]/.test(out)||/[/\\]apps[/\\]/.test(cacheDir))throw Error('Separate non-app candidate output required');
 const catalog=await json(input),registry=await json(join(root,'data/catalog-sources.json'));let serverEvidence;
 try{serverEvidence=await json(resolve(get('--evidence',join(root,'data/catalog-enrichment-evidence.json'))));}catch(e){if(e.code!=='ENOENT')throw e;}
 const result=await runCatalogEnrichment({catalog,registry,cacheDir,serverEvidence,documentDirs:args.flatMap((x,i)=>x==='--document-dir'?[resolve(args[i+1])]:[]),offline:args.includes('--offline'),maxPages:Number(get('--max-pages','24')),maxImages:Number(get('--max-images','24')),decode:decodeOriginal});
 const manifest=await writeEnrichedPair(result.catalog,out,{photoProofs:result.report.sourceProofs});await writeJSON(join(out,'enrichment-report.json'),{...result.report,revision:manifest.revision,sha256:manifest.sha256});console.log(JSON.stringify({records:manifest.count,revision:manifest.revision,features:result.report.features.completeRecords,partial:result.report.features.partialRecords,frames:result.report.photos.attached,network:result.report.network,failures:result.report.failures.length}));
}
