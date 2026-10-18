import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('src/features/products.json',root),'utf8'));
const ledger=JSON.parse(await readFile(new URL('public/product-sources.json',root),'utf8'));
const registry=JSON.parse(await readFile(new URL('public/catalog-sources.json',root),'utf8'));
test('every model preserves its exact source, SKU, color and unchanged original photo',async()=>{
 assert.equal(new Set(catalog.map(p=>p.id)).size,catalog.length);assert.equal(ledger.products.length,catalog.length);
 for(const product of catalog){
  const source=ledger.products.find(p=>p.id===product.id);assert.ok(source);
  const rule=registry.find(r=>r.brand===product.brand&&r.region===product.sourceRegion);assert.ok(rule,product.id);
  assert.ok(rule.hosts.includes(new URL(product.source).hostname),product.id);
  assert.ok(rule.imageHosts.includes(new URL(product.imageSource).hostname),product.id);
  for(const key of ['sku','color','source','imageSource','image','imageSha256'])assert.equal(product[key]??null,source[key],product.id+': '+key);
  assert.ok(product.model&&product.color);
  if(product.image.startsWith('/assets/products/')){const bytes=await readFile(new URL('public'+product.image,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),source.imageSha256);}
  else assert.equal(product.image,product.imageSource);
 }
});
test('prices keep their market and currency, unknown prices stay unknown, and snapshots verify by checksum',async()=>{
 assert.match(ledger.updateMode,/validated Crawlee/);
 for(const p of catalog){const source=ledger.products.find(s=>s.id===p.id);assert.equal(p.price,source.price);assert.equal(p.currency,source.currency);assert.ok(p.sourceRegion);assert.ok(p.price===null||Number.isFinite(p.price)&&p.price>0);assert.match(p.currency,/^[A-Z]{3}$/);assert.equal(p.checkedAt,source.checkedAt);assert.equal(p.stock,undefined);}
 const text=await readFile(new URL('public/catalog/verified-products.json',root),'utf8');
 const manifest=JSON.parse(await readFile(new URL('public/catalog/verified-products.manifest.json',root),'utf8'));
 assert.equal(createHash('sha256').update(text).digest('hex'),manifest.sha256);assert.equal(JSON.parse(text).products.length,manifest.count);
});
test('release dates retain stated precision and region; upcoming models require a source',()=>{
 for(const p of catalog){assert.match(p.release,/^(?:\d{4}-\d{2}(?:-\d{2})?)?$/);assert.equal(typeof p.releaseRegion,'string');assert.doesNotMatch(p.releaseRegion,/미확인|미공개|미정/);if(p.release||p.upcoming)assert.ok(p.releaseSource.startsWith('https://'));}
 assert.equal(catalog.find(p=>p.id==='adidas-adiospro4').release,'2025-01');
});
