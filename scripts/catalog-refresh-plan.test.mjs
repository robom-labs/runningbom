import test from 'node:test';import assert from 'node:assert/strict';import {load} from 'cheerio';
import {planCatalogSeeds,sourcePageDiagnosis,discoveredCatalogProduct,catalogRefreshPhases} from './catalog-refresh-plan.mjs';
test('24-request budget gives all 17 sources a slot; known official aliases remain schedulable after refresh',()=>{
 const registry=Array.from({length:17},(_,i)=>({id:'s'+i,brand:'B'+i,region:'R',hosts:['b'+i+'.test'],collections:[]}));
 const products=registry.flatMap((s,i)=>Array.from({length:6},(_,n)=>({brand:s.brand,sourceRegion:'R',source:'https://b'+i+'.test/p/'+n,checkedAt:'2026-10-01T00:00:00Z'})));
 const seeds=planCatalogSeeds(registry,products,24);assert.equal(seeds.length,17);assert.equal(new Set(seeds.map(s=>s.userData.sourceId)).size,17);
 const s={id:'asics-1',brand:'ASICS',region:'한국',hosts:['asics.co.kr'],collections:[]};
 assert.equal(planCatalogSeeds([s],[{brand:'ASICS',sourceRegion:'한국',source:'https://www.asics.co.kr/p/real',checkedAt:'2026-10-01T00:00:00Z'}],24).length,1);
 assert.equal(planCatalogSeeds(registry,products,3).length,3);
 const withCategory={...s,collections:['https://asics.co.kr/c/m-running-shoes']};
 assert.match(planCatalogSeeds([withCategory],[{brand:'ASICS',sourceRegion:'한국',source:'https://asics.co.kr/p/AKR_112630234-400',checkedAt:'2026-10-01T00:00:00Z'}],24)[0].url,/\/p\//);
});
test('observed ASICS product links exclude invalid placeholders and non-product account paths',()=>{
 const s={id:'asics-1',hosts:['asics.co.kr'],productPattern:'/p/'};
 assert.equal(discoveredCatalogProduct('https://asics.co.kr/p/AKR_112630234-400',s),true);
 for(const u of ['https://asics.co.kr/p/!#','https://asics.co.kr/joincheck/running','https://asics.co.kr/p/AKR_112630234-400#reviews'])assert.equal(discoveredCatalogProduct(u,s),false);
});
test('blocked HTML is not healthy empty product evidence; normal Shopify captcha bootstrap is not a block',()=>{
 assert.equal(sourcePageDiagnosis(load('<title>Access Denied</title>'),[]).status,'blocked-document');
 assert.equal(sourcePageDiagnosis(load('<title>Real shoe</title><script id="captcha-bootstrap"></script>'),[]).blockPage,false);
 assert.equal(sourcePageDiagnosis(load('<title>Real shoe</title>'),[{}]).status,'parsed');
});
test('valid candidate is not all-source collection success or proof of public publication',()=>{
 const r={sourceHealth:[{id:'good',verified:1},{id:'blocked',verified:0}],failures:[{source:'blocked'}],quarantined:[{sku:'unreviewed-size'}],verified:1,health:{ok:true}};
 const phases=catalogRefreshPhases(r,{write:true});assert.equal(phases.collection.status,'partial-failed');assert.equal(phases.validation.status,'passed');assert.equal(phases.admission.status,'review-required');assert.equal(phases.publication.status,'candidate-written');assert.equal(phases.publication.actualPublicPairVerified,false);
 assert.equal(catalogRefreshPhases({...r,verified:0,health:{ok:false}},{write:true}).publication.status,'not-requested');
});
