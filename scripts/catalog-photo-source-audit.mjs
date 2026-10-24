// Offline association audit, not an image/pixel audit. Never fetches or writes
// the canonical catalog. Only SHA-verified, dated official document caches count.
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {load} from 'cheerio';
import {extractProductCandidates,sha256} from './catalog-core.mjs';
import {approvedCatalogUrl} from './catalog-source-policy.mjs';
import {checkImageOwnership} from './catalog-image-ownership.mjs';

export function exactPhotoAssociation(product,row){
 if(!checkImageOwnership(row).ok)return false;
 if(row.knownCatalogId!==product.id)return false;
 return row.source===product.source&&row.sku===product.sku&&row.imageSource===product.imageSource&&
  row.color===product.color&&row.currency===product.currency&&row.sourceRegion===product.sourceRegion&&
  row.brand.toLowerCase()===product.brand.toLowerCase();
}
export function sourcePhotoProof(product,row,document){
 const age=Date.now()-Date.parse(document.checkedAt);
 if(!exactPhotoAssociation(product,row)||!/^[a-f0-9]{64}$/.test(document.sha256||'')||!Number.isFinite(age)||age< -300000||age>7*86400000)return null;
 return {id:product.id,sku:product.sku,brand:product.brand,model:product.model,color:product.color,
  productSource:product.source,imageSource:product.imageSource,sourceUrl:document.url,
  identityEvidenceSha256:document.sha256,checkedAt:document.checkedAt,
  kind:row.imageOwnership.kind,observedModel:row.model,observedSku:row.imageOwnership.declaredSku??row.sku};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),get=(k,f)=>{const i=args.indexOf(k);return i<0?f:args[i+1];};
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 const input=resolve(get('--catalog',resolve(root,'outputs/operations/catalog-review/verified-products.json'))),out=resolve(get('--out',resolve(root,'outputs/operations/catalog-photo-identity')));
 if(!out.startsWith(resolve(root,'outputs')+'/'))throw Error('Audit outputs must stay in project outputs');
 const catalogBytes=await readFile(input),catalog=JSON.parse(catalogBytes),registry=JSON.parse(await readFile(resolve(root,'data/catalog-sources.json'),'utf8'));
 const dirs=args.flatMap((x,i)=>x==='--cache-dir'?[resolve(args[i+1])]:[]),proofs=new Map(),documents=[],errors=[];
 for(const dir of dirs)for(const file of (await readdir(dir)).filter(f=>f.endsWith('.json'))){
  try{
   const meta=JSON.parse(await readFile(resolve(dir,file),'utf8')),url=meta.url;
   if(meta.status!==200||typeof url!=='string'||!/^[a-f0-9]{64}$/.test(meta.sha256||''))continue;
   const source=registry.find(s=>approvedCatalogUrl(url,s));if(!source)continue;
   const body=await readFile(resolve(dir,file.replace(/\.json$/,'.html')));if(sha256(body)!==meta.sha256)throw Error('Cached body SHA mismatch');
   const rows=extractProductCandidates(load(body.toString('utf8')),url,source,{previous:catalog.products});let matched=0;
   for(const row of rows){const p=catalog.products.find(p=>p.id===row.knownCatalogId);if(!p)continue;const proof=sourcePhotoProof(p,row,meta);if(proof){proofs.set(p.id,proof);matched++;}}
   documents.push({url,sha256:meta.sha256,checkedAt:meta.checkedAt,matched});
  }catch(e){errors.push({file,reason:e.message});}
 }
 // Dedicated ACG PDP receipt keeps its original DOM SHA/date. No source title
 // or opaque file name alone can establish the style/color association.
 const acgPath=get('--acg-receipt',null);
 if(acgPath){const receipt=JSON.parse(await readFile(resolve(acgPath),'utf8'));for(const p of catalog.products){
  const read=receipt.reads.find(r=>r.url===p.source&&/^[a-f0-9]{64}$/.test(r.documentDomSha256||''));
  const match=read?.matches.find(m=>m.sku===p.sku&&m.color===p.color&&m.image===p.imageSource);
  if(match&&Date.now()-Date.parse(receipt.checkedAt)<=7*86400000)proofs.set(p.id,{id:p.id,sku:p.sku,brand:p.brand,model:p.model,color:p.color,productSource:p.source,imageSource:p.imageSource,sourceUrl:read.url,identityEvidenceSha256:read.documentDomSha256,checkedAt:receipt.checkedAt,kind:'official-pdp-exact-style-color-jsonld',observedModel:match.title,observedSku:match.sku});
 }}
 const report={schemaVersion:1,checkedAt:new Date().toISOString(),catalogSha256:sha256(catalogBytes),catalogRevision:catalog.revision,records:catalog.products.length,networkRequests:0,associationVerified:proofs.size,unresolved:catalog.products.filter(p=>!proofs.has(p.id)).map(p=>({id:p.id,brand:p.brand,sku:p.sku,source:p.source,reason:'no-exact-source-SKU-color-image-cache-proof'})),documents,errors,proofs:[...proofs.values()],pixelIdentityClaim:false};
 await mkdir(out,{recursive:true});await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({records:report.records,associationVerified:proofs.size,unresolved:report.unresolved.length,documents:documents.length,errors:errors.length,networkRequests:0}));
}
