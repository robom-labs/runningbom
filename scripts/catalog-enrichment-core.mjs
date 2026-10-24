import {productFeatureIdentity,officialModelTitleMatches} from './shoe-features-core.mjs';
import {exactFrameForProduct} from './product-frame-audit-core.mjs';
import {approvedCatalogUrl} from './catalog-source-policy.mjs';
export const CACHE_TTL_MS=7*86400000;
const hash=v=>/^[a-f0-9]{64}$/.test(v||'');
export function withinTTL(checkedAt,now=Date.now(),ttl=CACHE_TTL_MS){const age=now-Date.parse(checkedAt);return Number.isFinite(age)&&age>=-300000&&age<=ttl;}
export function productSourceRegistry(p,registry){return registry.find(s=>s.brand.toLowerCase()===p.brand.toLowerCase()&&s.region===p.sourceRegion&&approvedCatalogUrl(p.source,s));}
export function validFeatureEvidence(p,e=p.decisionEvidence){
 return !!e&&e.schemaVersion===1&&e.productId===p.id&&e.sku===p.sku&&e.brand===p.brand&&e.source===p.source&&hash(e.sourceSha256)&&Number.isFinite(Date.parse(e.checkedAt))&&Date.parse(e.checkedAt)<=Date.now()+300000&&e.identity?.validated===true&&e.identity.identitySha256===productFeatureIdentity(p)&&Array.isArray(e.facts)&&e.facts.length>0&&e.facts.every(f=>f.source===p.source&&f.sourceSha256===e.sourceSha256)&&Array.isArray(e.features)&&e.features.length<=3&&e.features.every(f=>typeof f.title==='string'&&f.title.length<=40&&typeof f.body==='string'&&f.body.length<=180);
}
export function retainBoundEnrichment(p,now=Date.now()){
 const next={...p};let removedFeature=false,removedFrame=false;
 if(next.decisionEvidence&&!validFeatureEvidence(next)){
  const generated=Array.isArray(next.decisionEvidence.benefits)?next.decisionEvidence.benefits.slice(0,2).join('\n'):null;
  if(next.description===generated)next.description='';delete next.decisionEvidence;removedFeature=true;
 }
 if(next.imageFrame&&!exactFrameForProduct(next.imageFrame,next,now)){delete next.imageFrame;removedFrame=true;}
 return {product:next,removedFeature,removedFrame};
}
export function validPhotoProof(p,e,registry,now=Date.now()){
 const s=productSourceRegistry(p,registry);
 return !!s&&!!e&&e.id===p.id&&e.sku===p.sku&&e.brand===p.brand&&e.model===p.model&&officialModelTitleMatches(p,e.observedModel||'')&&e.color===p.color&&e.productSource===p.source&&e.imageSource===p.imageSource&&hash(e.identityEvidenceSha256)&&withinTTL(e.checkedAt,now)&&approvedCatalogUrl(e.sourceUrl,s)&&approvedCatalogUrl(p.imageSource,s,{image:true});
}
export function attachMeasuredPhoto(p,measurement,proof,registry,now=Date.now()){
 const safe=retainBoundEnrichment(p,now).product;
 if(!measurement||measurement.imageSource!==p.imageSource||!hash(measurement.sha256)||!withinTTL(measurement.checkedAt,now))return {product:safe,status:'no-current-measurement'};
 const approved=validPhotoProof(p,proof,registry,now);
 if(!approved&&p.imageSha256!==measurement.sha256)return {product:safe,status:'source-approval-required'};
 let next={...safe};
 if(approved){next.imageSha256=measurement.sha256;next.imageCheckedAt=measurement.checkedAt;next.imageVerification='original-bytes';if(next.image!==next.imageSource)next.image=next.imageSource;}
 if(measurement.status==='contain'){delete next.imageFrame;return {product:next,status:'contain'};}
 if(measurement.status!=='bounded'||!measurement.bounds)return {product:safe,status:'invalid-measurement'};
 const frame=exactFrameForProduct({sha256:measurement.sha256,imageSource:p.imageSource,productSource:p.source,...measurement.bounds,checkedAt:measurement.checkedAt},next,now);
 if(!frame)return {product:safe,status:'invalid-geometry'};
 return {product:{...next,imageFrame:frame},status:approved?'source-approved-frame':'exact-hash-last-good-frame'};
}
