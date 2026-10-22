import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyReviewedMetadata,matchReviewedFamily,repairCatalogMetadata,reviewedRegistry} from './catalog-family-metadata.mjs';
import {mergeVerified,catalogCandidateId} from './catalog-core.mjs';
const snapshot=JSON.parse(readFileSync(new URL('../data/verified-products.json',import.meta.url),'utf8'));
const pumaIds=new Set(['shoe-8bd93fa37950','shoe-e68460c9ef68','shoe-4eeaa7d38283','shoe-c3e317d24d14','shoe-41548a3b7663','shoe-023d51e319a9']);
const allowed=new Set(['model','modelEn','name','category','uses','sourceTitle','purpose','tier']);
const protectedFields=p=>Object.fromEntries(Object.entries(p).filter(([k])=>!allowed.has(k)));
const puma={brand:'PUMA',model:"Deviate NITRO™ Elite 3 Men's Road Running Shoes - Red-Black",color:'Red-Black',category:'stability',uses:['daily','long']};
test('Reviewed registry is the explicit 198-row baseline, not marketing-derived families',()=>{
 assert.equal(reviewedRegistry.provenance.count,198);assert.equal(reviewedRegistry.families.length,198);
 assert.equal(matchReviewedFamily(puma).id,'shoe-ff9d9ae6ac9b');
 const result=applyReviewedMetadata(puma);assert.equal(result.model,'Deviate NITRO Elite 3');assert.equal(result.category,'carbon');assert.deepEqual(result.uses,['race']);assert.equal(result.sourceTitle,puma.model);
});
test('All six published PUMA variants get carbon/race without changing SKU, price, provenance, images or timestamps',()=>{
 const rows=snapshot.products.filter(p=>pumaIds.has(p.id));assert.equal(rows.length,6);
 for(const row of rows){const bad={...row,model:row.sourceTitle||row.model,category:'stability',uses:['daily','long'],purpose:'탄탄한 지지',tier:'탄탄한 지지'};const next=applyReviewedMetadata(bad);assert.equal(next.model,'Deviate NITRO Elite 3');assert.equal(next.category,'carbon');assert.deepEqual(next.uses,['race']);assert.equal(next.purpose,'대회용 카본');assert.equal(next.tier,'대회용 카본');assert.deepEqual(protectedFields(next),protectedFields(bad));}
});
test('Exact known NIKE family drops only declared color, size and gender/road-shoe boilerplate',()=>{
 const p={brand:'NIKE',model:'나이키 페가수스 플러스 2 여성 로드 러닝화 - 실버/세일 - Size 5',color:'실버/세일'};
 const n=applyReviewedMetadata(p);assert.equal(n.model,'페가수스 플러스 2');assert.equal(n.category,'supertrainer');assert.equal(n.sourceTitle,p.model);
 assert.equal(matchReviewedFamily({...p,color:'another-color'}),null);
});
test('Unknown generation, Plus, Wide, GTX, GORE-TEX and ambiguous family never collapse to a shorter family',()=>{
 for(const model of ['Deviate NITRO Elite 30','Deviate NITRO Elite 3 Plus','Deviate NITRO Elite 3 Wide','Deviate NITRO Elite 3 GTX','Deviate NITRO Elite 3 GORE-TEX','Deviate NITRO Elite 3 Faster Shoes']){
  const p={...puma,model};assert.equal(matchReviewedFamily(p),null,model);const n=applyReviewedMetadata(p);assert.equal(n.model,model);assert.equal(n.category,'unknown');assert.deepEqual(n.uses,[]);
 }
 assert.equal(matchReviewedFamily({...puma,brand:'OTHER'}),null);
 const family=matchReviewedFamily(puma);assert.equal(matchReviewedFamily(puma,{families:[family,{...family,id:'conflict',category:'stability'}]}),null);
 const known={brand:'NIKE',model:'ACG 제가마 트레일 GORE-TEX'};assert.equal(matchReviewedFamily(known).model,known.model);
 assert.equal(matchReviewedFamily({brand:'NIKE',model:'보메로 18 GORE-TEX'}),null);
});
test('Marketing support/stability language and stale SKU category are not new-family evidence',()=>{
 const p={brand:'PUMA',model:'Unknown Runner 99 GTX',description:'stability support daily',category:'stability',uses:['daily']};
 const next=applyReviewedMetadata(p);assert.equal(next.model,p.model);assert.equal(next.category,'unknown');assert.deepEqual(next.uses,[]);assert.equal(next.purpose,'러닝화');assert.equal(next.tier,'러닝화');
 const updated=applyReviewedMetadata({...puma,category:'stability'});assert.equal(updated.category,'carbon');
});
test('Exact approved ID retains reviewed classification on refresh; ambiguous new IDs remain unknown',()=>{
 const family=matchReviewedFamily(puma),registry={families:[family,{...family,id:'reviewed-other-width',category:'stability'}]};
 const approved={...puma,id:family.id,price:99,sku:'observed-sku',checkedAt:'2026-10-22T04:49:40.535Z'};
 const next=applyReviewedMetadata(approved,registry);assert.equal(next.category,'carbon');assert.equal(next.purpose,'대회용 카본');assert.deepEqual(protectedFields(next),protectedFields(approved));
 assert.equal(applyReviewedMetadata({...approved,id:'new-unreviewed-id'},registry).category,'unknown');
});
test('Repair is deterministic/idempotent and allows only display fields/category/uses plus raw title',()=>{
 const bad={...snapshot,products:snapshot.products.map(p=>p.sourceTitle?{...p,model:p.sourceTitle,name:p.sourceTitle,modelEn:p.sourceTitle,category:'stability',uses:['daily']}:p)};
 const result=repairCatalogMetadata(bad);assert.deepEqual(repairCatalogMetadata(result.snapshot).snapshot,result.snapshot);
 assert.equal(result.snapshot.generatedAt,bad.generatedAt);assert.equal(result.snapshot.products.length,bad.products.length);
 for(let i=0;i<bad.products.length;i++)assert.deepEqual(protectedFields(result.snapshot.products[i]),protectedFields(bad.products[i]));
});
test('Canonical display names do not collapse distinct SKUs or overwrite their price/image',()=>{
 const rows=snapshot.products.filter(p=>pumaIds.has(p.id)).map(p=>applyReviewedMetadata(p));
 const result=mergeVerified([],rows);assert.equal(result.products.length,6);for(const row of rows)assert.deepEqual(result.products.find(p=>p.id===row.id),row);
});
test('Plain identical titles receive distinct SKU/URL-based IDs before display normalization; approved IDs survive',()=>{
 const base=snapshot.products[0];
 const a={...base,model:'Same Full Model 3',modelEn:'Same Full Model 3',sku:'SKU-A',price:101};
 const b={...a,sku:'SKU-B',price:202};
 a.id=catalogCandidateId(a);b.id=catalogCandidateId(b);assert.notEqual(a.id,b.id);
 const result=mergeVerified([],[a,b]);assert.equal(result.products.length,2);assert.equal(result.products.find(p=>p.id===a.id).price,101);assert.equal(result.products.find(p=>p.id===b.id).price,202);
 const x={...a,sku:null,source:'https://official.example/model?color=red'},y={...x,source:'https://official.example/model?color=blue'};
 assert.notEqual(catalogCandidateId(x),catalogCandidateId(y));assert.equal(catalogCandidateId(a,base),base.id);
 assert.deepEqual(mergeVerified([x],[{...y,id:x.id,price:1}]).products,[x]);
});
