import test from 'node:test';import assert from 'node:assert/strict';import {load} from 'cheerio';
import {officialBrooksGroups,officialGroupMetadata} from './catalog-official-groups.mjs';
import {extractProductCandidates,mergeVerified} from './catalog-core.mjs';
import {readFileSync} from 'node:fs';
const parent='https://brooksrunning.com.au/ghost-18-mens-neutral-running-shoe/110493.html';
const url=parent+'?colour=056&width=1D&size=9.5';
const child={'@type':'Product',name:'Ghost 18 - COLOR - Medium (1D) - Size 9.5',url,sku:'official-sku',width:'Medium (1D)',size:'9.5',color:'COLOR',image:'https://res.cloudinary.com/official.avif',offers:{price:259.95,priceCurrency:'AUD',url}};
const group={'@type':'ProductGroup',name:'Ghost 18',productGroupID:'110493',brand:{name:'Brooks'},hasVariant:[child]};
const html=g=>load('<link rel="canonical" href="'+parent+'"><script type="application/ld+json">'+JSON.stringify(g)+'</script>');
const product={brand:'Brooks',source:url,sku:child.sku,currency:'AUD',sourceRegion:'호주',gender:'남성'};
test('official parent, explicit width, child SKU and size produce a stable family without guessing names',()=>{
 const groups=officialBrooksGroups(html(group),parent,'2026-10-23T20:00:00.000Z');
 const meta=officialGroupMetadata(product,groups);
 assert.equal(meta.modelEn,'Ghost 18');assert.equal(meta.modelGroup,'brooks-au:110493');assert.equal(meta.width,'1D');assert.equal(meta.size,'9.5');assert.equal(meta.gender,'남성');assert.match(meta.modelGroupEvidence.schemaSha256,/^[a-f0-9]{64}$/);
 for(const patch of [{sku:'another'},{currency:'USD'},{gender:'여성'},{source:url.replace('1D','2E')},{source:url.replace('9.5','10')},{source:url.replace('brooksrunning.com.au','evil.example')}])assert.equal(officialGroupMetadata({...product,...patch},groups),null);
});
test('parent style records can join only with their explicit width/color and parent ID',()=>{
 const groups=officialBrooksGroups(html(group),parent);
 assert.equal(officialGroupMetadata({...product,source:parent+'?colour=056&width=1D',sku:'110493'},groups).width,'1D');
 assert.equal(officialGroupMetadata({...product,source:parent+'?colour=056',sku:'110493'},groups),null);
});
test('mismatched parent, canonical, brand, missing width or size do not authorize grouping',()=>{
 for(const patch of [{productGroupID:'999999'},{brand:'Unrelated'},{hasVariant:[{...child,width:''}]},{hasVariant:[{...child,size:'10'}]}])assert.equal(officialBrooksGroups(html({...group,...patch}),parent).length,0);
 assert.equal(officialBrooksGroups(html(group),parent.replace('110493','999999')).length,0);
});
test('collector preserves parent evidence and quarantines unbound size variants',()=>{
 const [row]=extractProductCandidates(html(group),parent,{brand:'Brooks',region:'호주'});
 assert.equal(row.model,'Ghost 18');assert.equal(row.sourceTitle,child.name);assert.equal(row.sku,child.sku);assert.equal(row.width,'1D');
 assert.equal(extractProductCandidates(html({...group,hasVariant:[{...child,width:''}]}),parent,{brand:'Brooks',region:'호주'}).length,0);
});
test('ordinary updates retain explicit family data and all SKU identities',()=>{
 const baseline=JSON.parse(readFileSync(new URL('../data/verified-products.json',import.meta.url))).products[0];
 const old={...baseline,modelGroup:'official-family',width:'1D'};
 const next={...baseline,checkedAt:new Date().toISOString()};
 assert.equal(mergeVerified([old],[next]).products[0].modelGroup,'official-family');
 assert.equal(mergeVerified([old],[next]).products[0].width,'1D');
});
