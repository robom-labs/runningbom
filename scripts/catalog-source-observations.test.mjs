import test from 'node:test';import assert from 'node:assert/strict';import {load} from 'cheerio';
import {bindKnownCatalogRow,variantAdmission,sourceBoundObservations} from './catalog-source-observations.mjs';
import {extractProductCandidates} from './catalog-core.mjs';
const karhu={id:'karhu-9',brand:'KARHU',region:'미국',hosts:['us.karhu.com'],imageHosts:['cdn.shopify.com']};
const url='https://us.karhu.com/products/official-style';
const old={id:'existing-style',brand:'KARHU',model:'Official Style',modelEn:'Official Style',source:url,sku:'F105019_8',currency:'USD',sourceRegion:'미국',color:'BLUE',gender:'남성'};
const row={...old,source:url+'?variant=1',observedIdentifiers:['F105019_8'],officialVariantEvidence:{productGroupID:'shopify_1',size:'8'}};
test('running-related accessory descriptions cannot turn gaiters or socks into shoe models',()=>{
 for(const model of ['Switchback Gaiter','Running Socks','트레일 게이터'])assert.equal(variantAdmission({model,description:'For trail running shoes',source:'https://official.test/product'}).ok,false);
 assert.equal(variantAdmission({model:'Trail Runner GTX',source:'https://official.test/product'}).ok,true);
});
test('same official SKU/market can refresh; unreviewed sizes stay quarantined, not invented as new models',()=>{
 const bound=bindKnownCatalogRow(row,karhu,[old]);assert.equal(bound.knownCatalogId,old.id);assert.equal(variantAdmission(bound).ok,true);assert.equal(bound.width,undefined);
 assert.equal(variantAdmission({...row,sku:'F105019_8.5'}).ok,false);
 for(const change of [{currency:'EUR'},{sourceRegion:'호주'},{source:url.replace('us.karhu.com','evil.test')},{source:url.replace('official-style','different-style')},{observedIdentifiers:[],sku:'DIFFERENT'}])assert.equal(bindKnownCatalogRow({...row,...change},karhu,[old]).knownCatalogId,undefined);
});
test('JSON-LD parent relation survives parser and controls quarantine even when child has no size field',()=>{
 const child={'@type':'Product',name:'Official Style - Blue / 8',sku:old.sku,image:'https://us.karhu.com/cdn/shop/files/F105019_1.jpg',offers:{price:180,priceCurrency:'USD',url:url+'?variant=1'}};
 const group={'@type':'ProductGroup',name:'Official Style',productGroupID:'shopify_1',brand:{name:'KARHU'},hasVariant:[child,{...child,sku:'F105019_8.5',name:'Official Style - Blue / 8.5',offers:{...child.offers,url:url+'?variant=2'}}]};
 const html='<script type="application/ld+json">'+JSON.stringify(group)+'</script>';
 const rows=extractProductCandidates(load(html),url,karhu,{previous:[old]});assert.equal(rows.length,2);
 assert.equal(rows.filter(r=>variantAdmission(r).ok).length,1);assert.equal(rows[0].officialVariantEvidence.productGroupID,'shopify_1');assert.equal(rows[1].officialVariantEvidence.size,null);
});
test('ASICS internal SKU binds only through current explicit manufacturer identifier and exact product path',()=>{
 const s={id:'asics-1',hosts:['asics.co.kr']},p={...old,id:'asics-known',brand:'ASICS',sku:'1011C249.400',source:'https://asics.co.kr/p/AKR_112630234-400',currency:'KRW',sourceRegion:'한국'};
 const r={...p,source:p.source.replace('https://','https://www.'),sku:'22748'};
 const bound=bindKnownCatalogRow(r,s,[p],{keywords:'젤 컨텐드 10,22748,1011C249400'});assert.equal(bound.sku,p.sku);assert.equal(bound.sourceSku,'22748');assert.equal(bound.knownCatalogId,p.id);
 assert.equal(bindKnownCatalogRow(r,s,[p],{keywords:'22748,DIFFERENT'}).knownCatalogId,undefined);
 assert.equal(bindKnownCatalogRow({...r,source:r.source.replace('-400','-999')},s,[p],{keywords:'1011C249400'}).knownCatalogId,undefined);
});
test('observed alternate schema SKU prevents parent MPN from duplicating a known exact variant',()=>{
 const p={...old,sku:'GTIN-123'},r={...row,sku:'STYLE-1',observedIdentifiers:['STYLE-1','GTIN-123']};
 assert.equal(bindKnownCatalogRow(r,karhu,[p]).sku,'GTIN-123');
});
test('HOKA official style URI can bind its existing manufacturer ID, but an unreviewed selected size cannot create a model',()=>{
 const source={id:'hoka-3',hosts:['au.hoka.com']},p={...old,brand:'HOKA',source:'https://au.hoka.com/products/m-mach-7-1171904-fyz-fyz',sku:'1171904-FYZ-FYZ',sourceRegion:'호주',currency:'AUD'};
 const row={...p,source:p.source+'?size=7',sku:null};
 const bound=bindKnownCatalogRow(row,source,[p]);assert.equal(bound.knownCatalogId,p.id);assert.equal(bound.sku,p.sku);assert.equal(variantAdmission(bound).ok,true);
 assert.equal(variantAdmission(row).ok,false);
 assert.equal(bindKnownCatalogRow(row,source,[{...p,sku:'DIFFERENT'}]).knownCatalogId,undefined);
});
test('Saucony own model table is identity evidence; UNISEX is not a generic brand alias',()=>{
 const s={id:'saucony-8',brand:'Saucony',region:'한국',hosts:['www.saucony.co.kr']},p={...old,brand:'Saucony',source:'https://www.saucony.co.kr/product/detail.html?product_no=571',sku:'S100981-1019',currency:'KRW',sourceRegion:'한국',gender:'공용'};
 const html='<table><tr><th>모델</th><td>S100981-1019</td></tr><tr><th>영문상품명</th><td>Endorphin Elite 3</td></tr></table><meta property="product:price:amount" content="369000"><meta property="product:price:currency" content="KRW"><meta property="og:image" content="https://ecimg.cafe24img.com/exact.jpg">';
 const rows=sourceBoundObservations(load(html),p.source,s,[p]);assert.equal(rows.length,1);assert.equal(rows[0].sku,p.sku);assert.equal(rows[0].price,369000);assert.equal(rows[0].knownCatalogId,p.id);
 assert.equal(sourceBoundObservations(load(html.replace('S100981-1019','DIFFERENT')),p.source,s,[p]).length,0);
 assert.equal(sourceBoundObservations(load(html),p.source.replace('571','570'),s,[p]).length,0);
});
test('Mizuno MPN microdata refresh clears undeclared price and never fabricates currency for a new product',()=>{
 const s={id:'mizuno-12',brand:'Mizuno',region:'유럽',hosts:['emea.mizuno.com']},p={...old,brand:'Mizuno',source:'https://emea.mizuno.com/eu/en/runner/K1.html',sku:'K1',currency:'EUR',sourceRegion:'유럽'};
 const html='<div itemscope itemtype="https://schema.org/Product"><meta itemprop="mpn" content="K1"><div itemprop="brand"><meta itemprop="name" content="Mizuno"></div><h1 itemprop="name">Runner</h1><img itemprop="image" src="https://emea.mizuno.com/exact.png?sw=95"><img itemprop="image" src="https://emea.mizuno.com/exact.png?sw=950"></div>';
 const [row]=sourceBoundObservations(load(html),p.source,s,[p]);assert.equal(row.price,null);assert.equal(row.currency,'EUR');assert.equal(row.priceObservation,'not-declared');assert.match(row.imageSource,/sw=950/);
 assert.equal(sourceBoundObservations(load(html),p.source,s,[]).length,0);
});
test('Nike announcement reads explicit launch month from approved article, never creates retail SKU/price',()=>{
 const s={id:'nike-press-global',brand:'NIKE',region:'공식 글로벌 발표',hosts:['about.nike.com']},p={...old,brand:'NIKE',source:'https://about.nike.com/en/newsroom/releases/official-shoe',sku:null,currency:'KRW',sourceRegion:s.region,evidenceKind:'official-announcement'};
 const data={props:{pageProps:{data:{title:'Official Shoe',blocks:[{summary_text:'<p>When is it available?</p><p>It will launch in China in February 2027 before global availability.</p>'}]}}}};
 const html='<meta property="og:image" content="https://nmp.about.nike.com/exact.jpg"><script id="__NEXT_DATA__">'+JSON.stringify(data)+'</script>';
 const [row]=sourceBoundObservations(load(html),p.source,s,[p]);assert.equal(row.release,'2027-02');assert.equal(row.releaseRegion,'중국');assert.equal(row.price,null);assert.equal(row.sku,null);assert.equal(row.knownCatalogId,p.id);
 assert.equal(sourceBoundObservations(load(html),p.source.replace('official-shoe','unreviewed'),s,[p]).length,0);
});
