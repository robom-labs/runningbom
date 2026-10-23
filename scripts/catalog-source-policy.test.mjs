import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {load} from 'cheerio';
import {approvedCatalogUrl,resolveDeclaredCatalogUrl,sameApprovedCatalogHost} from './catalog-source-policy.mjs';
import {extractProductCandidates} from './catalog-core.mjs';
test('only observed ASICS/Brooks aliases are accepted, never arbitrary siblings',()=>{
  const a={id:'asics-1',hosts:['asics.co.kr'],imageHosts:['d26wss9rw703v0.cloudfront.net']};
  assert.equal(approvedCatalogUrl('https://www.asics.co.kr/p/AKR_112630234-400',a),true);
  for(const url of ['http://www.asics.co.kr/p/x','https://www.asics.co.kr.evil.test/p/x','https://evil@www.asics.co.kr/p/x','https://shop.asics.co.kr/p/x','https://www.asics.co.kr:8443/p/x'])assert.equal(approvedCatalogUrl(url,a),false);
  assert.equal(approvedCatalogUrl('https://www.asics.co.kr/p/x',{...a,id:'unknown'}),false);
  assert.equal(approvedCatalogUrl('https://brooksrunning.com.au/120486.html',{id:'brooks-14',hosts:['www.brooksrunning.com.au']}),true);
});
test('Topo first-party Shopify path is exact and never grants unrelated image hosts/paths',()=>{
  const s={id:'topo-athletic-5',hosts:['topoathletic.com.au'],imageHosts:['cdn.shopify.com']};
  assert.equal(approvedCatalogUrl('https://topoathletic.com.au/cdn/shop/files/M092-Navy-Orange_00.png',s,{image:true}),true);
  for(const u of ['https://topoathletic.com.au/other.png','https://www.topoathletic.com.au/cdn/shop/a.png','https://evil.test/cdn/shop/a.png'])assert.equal(approvedCatalogUrl(u,s,{image:true}),false);
});
test('declared relative URLs resolve against observed page, HTTP and credentials stay rejected',()=>{
  assert.equal(resolveDeclaredCatalogUrl('/p/real','https://example.org/collection'),'https://example.org/p/real');
  assert.equal(resolveDeclaredCatalogUrl('//cdn.example.org/a.png','https://example.org'),'https://cdn.example.org/a.png');
  for(const v of ['http://example.org/x','javascript:alert(1)','https://u:p@example.org/x',null,''])assert.equal(resolveDeclaredCatalogUrl(v,'https://example.org'),null);
  const html='<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'Real Runner',brand:'Example',image:'//cdn.example.org/a.png',offers:{price:1,priceCurrency:'USD',url:'/p/real'}})+'</script>';
  const [p]=extractProductCandidates(load(html),'https://example.org/collection',{brand:'Example',region:'US'});assert.equal(p.source,'https://example.org/p/real');assert.equal(p.imageSource,'https://cdn.example.org/a.png');
});
test('collector actually applies product and image policy (no registry data modified)',async()=>{
  const text=await readFile(new URL('./refresh-verified-products.mjs',import.meta.url),'utf8');assert.match(text,/const permit=.*approvedCatalogUrl/);assert.match(text,/approvedCatalogUrl\(row.imageSource,source,\{image:true\}\)/);
});
test('alias identity is narrow and collector keeps cross-market SKU and no-image-download safety',async()=>{
 const source={id:'asics-1',hosts:['asics.co.kr']};assert.equal(sameApprovedCatalogHost('https://asics.co.kr/p/a','https://www.asics.co.kr/p/a',source),true);assert.equal(sameApprovedCatalogHost('https://asics.co.kr/p/a','https://asics.com/us/p/a',source),false);
 const text=await readFile(new URL('./refresh-verified-products.mjs',import.meta.url),'utf8');assert.match(text,/p.sourceRegion===row.sourceRegion&&p.currency===row.currency&&sameApprovedCatalogHost/);assert.match(text,/cross-market SKU update quarantined/);assert.match(text,/Metadata-only operation: no image download/);assert.doesNotMatch(text,/fetch\(row.imageSource/);
});
