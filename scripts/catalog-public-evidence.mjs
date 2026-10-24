import {isDeepStrictEqual} from 'node:util';import {createHash} from 'node:crypto';
import {productFeatureIdentity} from './shoe-features-core.mjs';
export const PUBLIC_CATALOG_BUDGET=3_500_000; // below the app's 4MiB text cap
const keys=['schemaVersion','productId','sku','brand','source','sourceSha256','checkedAt','headline','supportingText','features','benefits','tradeoff','completeness'];
const sha=x=>createHash('sha256').update(x).digest('hex');
export function publicDecisionEvidence(e){return Object.fromEntries(keys.filter(k=>e?.[k]!==undefined).map(k=>[k,e[k]]));}
export function publicCatalog(catalog){return {...catalog,products:catalog.products.map(p=>p.decisionEvidence?{...p,decisionEvidence:publicDecisionEvidence(p.decisionEvidence)}:p)};}
export function assertPublicBudget(text){if(Buffer.byteLength(text)>PUBLIC_CATALOG_BUDGET||text.length>PUBLIC_CATALOG_BUDGET)throw Error('Public catalog payload budget exceeded; retain last good pair, never drop SKUs');return {bytes:Buffer.byteLength(text),characters:text.length,budget:PUBLIC_CATALOG_BUDGET};}
export function captureServerEvidence(catalog,photoProofs=[]){
 return {schemaVersion:1,generatedAt:new Date().toISOString(),sourceCatalogRevision:catalog.revision,featureRecords:catalog.products.filter(p=>p.decisionEvidence?.identity?.validated===true&&Array.isArray(p.decisionEvidence.facts)).map(p=>({id:p.id,identitySha256:productFeatureIdentity(p),publicEvidenceSha256:sha(JSON.stringify(publicDecisionEvidence(p.decisionEvidence))),decisionEvidence:{...publicDecisionEvidence(p.decisionEvidence),identity:{validated:true,identitySha256:productFeatureIdentity(p)},facts:p.decisionEvidence.facts.map(f=>({id:f.id,kind:f.kind,korean:f.korean,match:String(f.match||'').slice(0,80),source:f.source,sourceSha256:f.sourceSha256}))}})),photoProofs};
}
export function restoreServerEvidence(catalog,audit){
 if(!audit)return catalog;if(audit.schemaVersion!==1||!Array.isArray(audit.featureRecords))throw Error('Invalid server evidence schema');
 if(new Set(audit.featureRecords.map(r=>r.id)).size!==audit.featureRecords.length)throw Error('Duplicate server evidence ID');const byId=new Map(audit.featureRecords.map(r=>[r.id,r]));
 return {...catalog,products:catalog.products.map(p=>{const r=byId.get(p.id);if(!p.decisionEvidence||!r||r.identitySha256!==productFeatureIdentity(p)||r.publicEvidenceSha256!==sha(JSON.stringify(publicDecisionEvidence(p.decisionEvidence)))||!isDeepStrictEqual(publicDecisionEvidence(r.decisionEvidence),publicDecisionEvidence(p.decisionEvidence)))return p;return {...p,decisionEvidence:r.decisionEvidence};})};
}
