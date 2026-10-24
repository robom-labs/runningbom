import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shoeFeatureModelKey,shoeFeaturePageKey,extractShoeFeatureSource,buildShoeFeaturePatch,translateShoeFacts,productFeatureIdentity,applyShoeFeatureEvidence,upgradeShoeFeaturePatch,digest} from './shoe-features-core.mjs';
import {officialFeatureClient,publicAddress,boundedOfficialGet} from './shoe-features-fetch.mjs';
const p={id:'nike-aero42-blue',brand:'NIKE',model:'에어로 42',modelEn:'Aero 42',sku:'AA4242-100',source:'https://www.nike.com/kr/t/aero-42/AA4242-100',gender:'남성',sourceRegion:'한국',currency:'KRW',description:'old',price:123,color:'blue'};
const node=(overrides={})=>({'@type':'Product',name:'Nike Aero 42 Men',mpn:p.sku,brand:{name:'NIKE'},url:p.source,description:'ZoomX foam and a full carbon-fibre plate. Breathable mesh upper.',...overrides});
const html=n=>`<html><head><script type="application/ld+json">${JSON.stringify(n)}</script></head><body><h1>Nike Aero 42 Men</h1></body></html>`;
const extract=(n,product=p)=>extractShoeFeatureSource(html(n),product,{checkedAt:'2026-10-24T00:00:00.000Z'});
test('exact source, generation and SKU produce grounded, bounded Korean fields',()=>{
 const source=extract(node()),result=buildShoeFeaturePatch(p,source);assert.equal(result.ok,true);
 const e=result.patch.decisionEvidence;
 assert.deepEqual([e.schemaVersion,e.productId,e.sku,e.brand,e.source],[1,p.id,p.sku,p.brand,p.source]);
 assert.equal(e.sourceSha256,digest(html(node())));assert.equal(e.checkedAt,'2026-10-24T00:00:00.000Z');
 assert.ok(e.headline.length<=130);assert.ok(e.supportingText.length<=100);assert.ok(e.features.length<=3);
 for(const f of e.features){assert.ok(f.title.length<=30);assert.ok(f.body.length<=120);}
 assert.ok(e.benefits.some(x=>x.includes('탄소 섬유판')));assert.ok(!e.benefits.some(x=>/편안|통증|부상|최고/.test(x)));
});
test('Korean title is an exact alternate identity, not only English modelEn',()=>{
 assert.equal(extract(node({name:'나이키 에어로 42 남성'})).ok,true);
});
test('generation 4 never inherits 42 even with matching SKU',()=>{
 assert.equal(extract(node(),{...p,model:'에어로 4',modelEn:'Aero 4'}).ok,false);
});
test('Premium and Plus qualifiers are not dropped',()=>{
 assert.equal(extract(node(),{...p,model:'에어로 42 프리미엄',modelEn:'Aero 42 Premium'}).ok,false);
});
test('female and junior sources cannot fill a male adult model',()=>{
 assert.equal(extract(node({name:'Nike Aero 42 Women'})).ok,false);
 assert.equal(extract(node({name:'Nike Aero 42 Junior'})).ok,false);
});
test('wrong brand in same-page structured data is rejected',()=>{
 assert.equal(extract(node({brand:{name:'Unrelated brand'}})).ok,false);
});
test('wrong product URL cannot donate recommendations from the same page',()=>{
 assert.equal(extractShoeFeatureSource(html(node()),p,{source:'https://www.nike.com/kr/t/aero-43/AA4343-100'}).ok,false);
});
test('an incorrect junior ProductGroup does not override the exact adult child',()=>{
 const source=extract({'@type':'ProductGroup',name:'Nike Aero 42 Junior',url:p.source,description:'GORE-TEX and GuideRails',hasVariant:[node()]});
 assert.equal(source.ok,true);const facts=translateShoeFacts(source);assert.ok(!facts.some(f=>['goretex','guiderails'].includes(f.id)));assert.ok(facts.some(f=>f.id==='carbon'));
});
test('unrelated page/footer text is not product description',()=>{
 const source=extractShoeFeatureSource(html(node({description:''}))+'<footer>ZoomX carbon plate</footer>',p);
 assert.equal(source.reason,'no-scoped-product-description');
});
test('category-only prose does not get promoted to product benefits',()=>{
 const result=buildShoeFeaturePatch(p,extract(node({description:'A daily running shoe for every runner and every day.'})));
 assert.equal(result.ok,false);assert.equal(result.reason,'no-translatable-product-facts');
});
test('one material alone does not masquerade as complete product copy',()=>{
 assert.equal(buildShoeFeaturePatch(p,extract(node({description:'This new running model features ZoomX foam underfoot.'}))).reason,'only-one-distinct-product-fact');
});
test('explicitly absent or previous-version technology is not a current fact',()=>{
 const facts=translateShoeFacts(extract(node({description:'Without carbon plate. Previous ZoomX construction is discontinued. Breathable mesh upper.'})));
 assert.ok(!facts.some(f=>f.id==='carbon'||f.id==='zoomx'));
});
test('multiple foam mentions alone do not count as multiple feature dimensions',()=>{
 assert.equal(buildShoeFeaturePatch(p,extract(node({description:'ZoomX foam, ReactX foam and FF BLAST MAX foam.'}))).ok,false);
});
test('future model and annual update are extracted with no model-specific whitelist',()=>{
 const next={...p,id:'future-2028',model:'에어로 45',modelEn:'Aero 45',sku:'AA4545-100',source:'https://www.nike.com/kr/t/aero-45/AA4545-100'};
 const source=extractShoeFeatureSource(html(node({name:'Nike Aero 45 Men',url:next.source,mpn:next.sku,description:'A ZoomX foam and carbon plate model for race day.'})),next,{checkedAt:'2028-01-01T00:00:00.000Z'});
 assert.equal(buildShoeFeaturePatch(next,source).patch.decisionEvidence.productId,next.id);
 const wrong=extractShoeFeatureSource(html(node()),next);assert.equal(wrong.ok,false);
});
test('size URL selectors dedup, but market/product path and product_no remain separate',()=>{
 assert.equal(shoeFeaturePageKey('https://brooksrunning.com.au/a/100.html?width=2E&size=8&colour=001'),'https://brooksrunning.com.au/a/100.html');
 assert.notEqual(shoeFeaturePageKey('https://official.example/p?product_no=1'),shoeFeaturePageKey('https://official.example/p?product_no=2'));
 assert.notEqual(shoeFeaturePageKey('https://official.example/us/a'),shoeFeaturePageKey('https://official.example/au/a'));
});
test('model grouping preserves width/gender and unknown identities',()=>{
 const b={...p,brand:'Brooks',model:'Ghost 18',modelEn:'Ghost 18',modelGroup:'brooks-au:110493',width:'1D'};
 assert.notEqual(shoeFeatureModelKey(b),shoeFeatureModelKey({...b,width:'2E'}));
 assert.notEqual(shoeFeatureModelKey(b),shoeFeatureModelKey({...b,gender:'여성'}));
 assert.notEqual(shoeFeatureModelKey({...b,modelGroup:undefined,id:'one'}),shoeFeatureModelKey({...b,modelGroup:undefined,id:'two'}));
});
test('patch application keeps every variant, price and photo, and refuses changed identity',()=>{
 const result=buildShoeFeaturePatch(p,extract(node()));const evidence={records:[{id:p.id,identitySha256:productFeatureIdentity(p),patch:result.patch}]};
 const applied=applyShoeFeatureEvidence({products:[p]},evidence);assert.equal(applied.applied,1);assert.equal(applied.catalog.products[0].price,p.price);
 for(const key of ['sku','source','gender','currency','sourceRegion','model','width'])assert.equal(applyShoeFeatureEvidence({products:[{...p,[key]:'changed'}]},evidence).rejected,1,key);
});
test('metadata migration preserves actual source hash and original checkedAt',()=>{
 const patch=buildShoeFeaturePatch(p,extract(node())).patch;const next=upgradeShoeFeaturePatch(p,patch);
 assert.equal(next.decisionEvidence.sourceSha256,patch.decisionEvidence.sourceSha256);assert.equal(next.decisionEvidence.checkedAt,patch.decisionEvidence.checkedAt);
 assert.equal(upgradeShoeFeaturePatch({...p,source:'https://www.nike.com/other'},patch),null);
});
test('nonpublic IPv4/IPv6 are rejected, including mapped private addresses',()=>{
 for(const ip of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.0.1','169.254.1.2','100.64.0.1','::1','::ffff:127.0.0.1','fe80::1','2001:db8::1'])assert.equal(publicAddress(ip),false,ip);
 assert.equal(publicAddress('8.8.8.8'),true);
});
test('HTTP, credential URLs and unapproved hosts fail before requests',async()=>{
 for(const u of ['http://www.nike.com/a','https://user:pass@www.nike.com/a','https://evil.example/a','https://127.0.0.1/a'])await assert.rejects(()=>boundedOfficialGet(u,{allowedHosts:new Set(['www.nike.com'])}),/unapproved/);
});
test('robots disallow fails closed without requesting product HTML',async()=>{
 let calls=0;const client=officialFeatureClient({allowedHosts:new Set(['official.example']),get:async()=>{calls++;return {status:200,body:'User-agent: *\nDisallow: /products/',contentType:'text/plain'};}});
 await assert.rejects(()=>client('https://official.example/products/a'),/robots-disallowed/);assert.equal(calls,1);
});
test('robots 429 is a failure, never bypassed or retried immediately',async()=>{
 let calls=0;const client=officialFeatureClient({allowedHosts:new Set(['official.example']),get:async()=>{calls++;return {status:429,body:''};}});
 await assert.rejects(()=>client('https://official.example/products/a'),/robots-http-429/);assert.equal(calls,1);
});
test('redirect cannot escape approved official origins',async()=>{
 const client=officialFeatureClient({allowedHosts:new Set(['official.example']),get:async u=>u.endsWith('/robots.txt')?{status:404}:{status:301,location:'https://evil.example/p'}});
 await assert.rejects(()=>client('https://official.example/p'),/redirect-outside-approved-source/);
});
test('a normal product page using checkout reCAPTCHA is not an access challenge',async()=>{
 const client=officialFeatureClient({allowedHosts:new Set(['official.example']),get:async u=>u.endsWith('/robots.txt')?{status:404}:{status:200,contentType:'text/html',body:'<title>Ghost 18 official product</title><h1>Ghost 18</h1><script src="recaptcha.js"></script>'}});
 assert.equal((await client('https://official.example/p')).status,200);
});
test('actual interstitials still fail closed without solving the challenge',async()=>{
 const client=officialFeatureClient({allowedHosts:new Set(['official.example']),get:async u=>u.endsWith('/robots.txt')?{status:404}:{status:200,contentType:'text/html',body:'<title>Just a moment</title><h1>Verify you are human</h1>'}});
 await assert.rejects(()=>client('https://official.example/p'),/access-challenge/);
});
test('PEBAX plate does not get translated as PEBA foam',()=>{
 const facts=translateShoeFacts(extract(node({description:'Split PEBAX plate for fast tempo runs and race day.'})));
 assert.ok(facts.some(f=>f.id==='pebaxplate'));assert.ok(!facts.some(f=>f.id==='peba'));
});
test('exact Brooks Inertia product, not navigation/recommended generations, supplies construction',()=>{
 const bp={...p,id:'brooks-ghost18-7',brand:'Brooks',model:'Ghost 18',modelEn:'Ghost 18',sku:'503004',source:'https://brooksrunning.com.au/ghost-18-mens-neutral-running-shoe/110493.html?colour=172&width=1B&size=7',width:'1B',modelGroup:'brooks-au:110493',sourceRegion:'호주',currency:'AUD'};
 const group={'@type':'ProductGroup',name:'Ghost 18',brand:'Brooks',productGroupID:'110493',url:bp.source,description:'A daily road running shoe.',hasVariant:[{'@type':'Product',name:'Ghost 18 - White - Narrow (1B) - Size 7',sku:bp.sku,url:bp.source}]};
 const data={props:{navCategories:[{description:'GORE-TEX and carbon plate'}],product:{name:'Ghost 18',style:'110493',slug:'ghost-18-mens-neutral-running-shoe/110493.html?colour=429&width=1D',attributes:[{key:'GENDER',value:'M'},{key:'MIDSOLE_TECH',value:'DNA LOFT v3'},{key:'UPPER_TECH',value:'New flat knit tongue'},{key:'FEATURES',value:'GORE-TEX and carbon plate'}]}}};
 const doc=html(group)+`<div data-page='${JSON.stringify(data).replace(/'/g,'&#39;')}'></div>`;
 const result=buildShoeFeaturePatch(bp,extractShoeFeatureSource(doc,bp));assert.equal(result.ok,true);
 assert.ok(result.facts.some(f=>f.id==='dnaloft3'));assert.ok(result.facts.some(f=>f.id==='knittongue'));assert.ok(!result.facts.some(f=>f.id==='carbon'||f.id==='goretex'));
 assert.equal(result.binding.officialProductGroup,'110493');
});
test('Brooks Inertia data from a different style cannot fill this product',()=>{
 const bp={...p,brand:'Brooks',model:'Ghost 18',modelEn:'Ghost 18',source:'https://brooksrunning.com.au/ghost-18-mens-neutral-running-shoe/110493.html'};
 const group={'@type':'ProductGroup',name:'Ghost 18',brand:'Brooks',productGroupID:'110493',url:bp.source,description:'An everyday shoe.'};
 const data={props:{product:{name:'Ghost 18',style:'110492',slug:'ghost-18-mens-neutral-running-shoe/110493.html',attributes:[{key:'MIDSOLE_TECH',value:'DNA LOFT v3'},{key:'UPPER_TECH',value:'New flat knit tongue'}]}}};
 const doc=html(group)+`<div data-page='${JSON.stringify(data)}'></div>`;
 assert.equal(buildShoeFeaturePatch(bp,extractShoeFeatureSource(doc,bp)).ok,false);
});
test('neutral model titles cannot hide a women-only source URL from a male record',()=>{
 const bp={...p,model:'Ghost 18',modelEn:'Ghost 18',brand:'Brooks',source:'https://brooksrunning.com.au/ghost-18-womens-neutral-running-shoe/120493.html'};
 assert.equal(extractShoeFeatureSource(html(node()),bp).reason,'source-gender-conflict');
});
test('a product 429 stops subsequent same-origin reads and honors Retry-After',async()=>{
 let requests=0;const client=officialFeatureClient({allowedHosts:new Set(['official.example']),get:async u=>{requests++;return u.endsWith('/robots.txt')?{status:404}:{status:429,retryAfter:'120',body:''};}});
 await assert.rejects(()=>client('https://official.example/a'),/product-http-429/);
 await assert.rejects(()=>client('https://official.example/b'),/origin-cooldown-after-429/);assert.equal(requests,2);
});
test('Nike hidden details provide model construction, not navigation recommendations',()=>{
 const doc=html(node({description:'A responsive running shoe for daily runs.'}))+'<div data-testid="hidden-product-details"><section data-testid="benefit-section">ZoomX foam and Vibram Megagrip outsole.</section></div><nav>GORE-TEX</nav>';
 const result=buildShoeFeaturePatch(p,extractShoeFeatureSource(doc,p));assert.equal(result.ok,true);assert.ok(result.facts.some(f=>f.id==='vibrammegagrip'));assert.ok(!result.facts.some(f=>f.id==='goretex'));
});
test('a genuinely new foam technology remains a dictionary gap, not fake foam claims',()=>{
 const result=buildShoeFeaturePatch(p,extract(node({description:'New AstroBlob technology underfoot for daily runs.'})));
 assert.equal(result.ok,false);assert.ok(!result.facts.some(f=>f.kind==='cushion'));
});
