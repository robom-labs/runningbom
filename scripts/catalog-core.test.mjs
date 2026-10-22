import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {load} from 'cheerio';
import {mergeVerified,extractProductCandidates,fingerprint,productSchema,sha256,declaredReleaseDate,releaseIsUpcoming,declaredProductGender} from './catalog-core.mjs';
import {catalogIdentityProblems,catalogRecordKey} from './catalog-identity.mjs';
const snapshot=JSON.parse(await readFile(new URL('../data/verified-products.json',import.meta.url),'utf8'));const one=snapshot.products[0];
test('Source catalog has exact original photos, unique models, currencies and no invented release dates',()=>{
 const ids=new Set(),models=new Set();
 for(const p of snapshot.products){productSchema.parse(p);const identity=catalogRecordKey(p);assert(!ids.has(p.id));assert(!models.has(identity));ids.add(p.id);models.add(identity);assert(p.imageSha256||p.imageVerification==='official-page-url');if(p.release)assert(p.releaseSource);if(p.upcoming)assert(p.releaseSource);}
 assert(snapshot.products.length>=100);assert(new Set(snapshot.products.map(p=>p.brand)).size>=15);
 assert.deepEqual(catalogIdentityProblems(snapshot.products),[]);
});
test('Gallery captions cannot be published as new products or colors',()=>{
 assert.throws(()=>mergeVerified([one],[{...one,id:'image-only',model:one.model+' product image'}]),/invalid candidate/);
 assert.throws(()=>productSchema.parse({...one,color:'Image 1 of 8'}));
 assert.equal(catalogIdentityProblems([one,{...one,id:'second-photo'}]).length,1);
 const renamed={...one,id:'new-id',model:'Official renamed running shoe',name:'Official renamed running shoe'};
 if(one.sku)assert.equal(mergeVerified([one],[renamed]).products.length,1);
});
test('Source failure or an older response cannot erase the last good catalog',()=>{
 assert.deepEqual(mergeVerified([one],[]).products,[one]);
 const stale={...one,checkedAt:'2020-01-01T00:00:00Z',price:1};assert.deepEqual(mergeVerified([one],[stale]).products,[one]);
 assert.throws(()=>mergeVerified([one],[{...one,price:-1}]),/invalid candidate/);
});
test('Prices and images from a different SKU cannot overwrite the selected color',()=>{
 assert.deepEqual(mergeVerified([one],[{...one,sku:'DIFFERENT-COLOR',price:1}]).products,[one]);
 const other={...one,id:'different-color-id',sku:'DIFFERENT-COLOR',price:1};
 const result=mergeVerified([one],[other]).products;assert.equal(result.length,2);assert.deepEqual(result[0],one);assert.deepEqual(result[1],other);
});
test('Reviewed tempo and recovery use tags survive a later official price refresh',()=>{
 const product=snapshot.products.find(p=>p.uses.includes('tempo'));
 assert(product?.useEvidence.some(item=>item.use==='tempo'&&item.url.startsWith('https://')));
 const incoming={...product,uses:product.uses.filter(use=>use!=='tempo'),checkedAt:'2026-10-19T00:00:00Z'};
 const updated=mergeVerified([product],[incoming]).products[0];
 assert(updated.uses.includes('tempo'));assert.deepEqual(updated.useEvidence,product.useEvidence);
 for(const id of ['nike-vomero18','shoe-7c2ef09ece4a','shoe-11d87a800ee4']){
  const reviewed=snapshot.products.find(p=>p.id===id);assert(reviewed,`missing reviewed recovery ID ${id}`);assert(reviewed.uses.includes('recovery'),`lost reviewed recovery role ${id}`);
 }
});
test('Schema.org parser reads only declared product values and does not manufacture a launch date',()=>{
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'Pegasus 99',brand:{name:'NIKE'},sku:'ABC-100',image:'https://static.nike.com/exact.jpg',offers:{price:100,priceCurrency:'USD',url:'https://www.nike.com/t/exact'}})+'</script>';
 const [p]=extractProductCandidates(load(html),'https://www.nike.com/t/exact',{brand:'NIKE',region:'미국'});assert.equal(p.currency,'USD');assert.equal(p.sku,'ABC-100');assert.equal(p.release,undefined);
});
test('Published snapshot matches its SHA-256 manifest',async()=>{
 const text=await readFile(new URL('../data/verified-products.json',import.meta.url),'utf8');const m=JSON.parse(await readFile(new URL('../data/verified-products.manifest.json',import.meta.url),'utf8'));assert.equal(sha256(Buffer.from(text)),m.sha256);assert.equal(snapshot.products.length,m.count);
});
test('Official release dates preserve month precision, reject impossible dates and stop being upcoming after launch',()=>{
 assert.equal(declaredReleaseDate('2026-11'),'2026-11');assert.equal(declaredReleaseDate('2026-11-02T09:00:00+09:00'),'2026-11-02');
 assert.equal(declaredReleaseDate('2026-02-30'),undefined);assert.equal(declaredReleaseDate('2026-13'),undefined);assert.equal(declaredReleaseDate('신제품'),undefined);
 assert.equal(releaseIsUpcoming('2026-11',new Date('2026-10-18T01:00:00Z')),true);
 assert.equal(releaseIsUpcoming('2026-10-17',new Date('2026-10-18T01:00:00Z')),false);
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'Confirmed Runner',brand:'NIKE',releaseDate:'2026-11',image:'https://static.nike.com/exact.jpg',offers:{price:100,priceCurrency:'USD'}})+'</script>';
 assert.equal(extractProductCandidates(load(html),'https://www.nike.com/t/exact',{brand:'NIKE',region:'미국'})[0].release,'2026-11');
});
test('Missing gender metadata is unknown; official women URLs do not become men or unisex',()=>{
 assert.equal(declaredProductGender(undefined,'https://official.example/products/runner'),'미확인');
 assert.equal(declaredProductGender(undefined,'https://official.example/womens/runner'),'여성');
 assert.equal(declaredProductGender(undefined,'https://official.example/men/runner'),'남성');
 assert.equal(declaredProductGender(undefined,'https://official.example/t/남성-러닝화'),'남성');
 assert.equal(declaredProductGender('unisex'),'공용');
});
