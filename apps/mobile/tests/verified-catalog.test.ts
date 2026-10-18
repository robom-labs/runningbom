import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {resolve} from 'node:path';
import {acceptCatalog,catalogSchema} from '../domains/catalog/contracts';
import snapshot from '../data/catalog/verified-products.json';
test('Catalog updates reject empty, duplicate and older snapshots',()=>{
 const current=catalogSchema.parse(snapshot);
 assert.throws(()=>acceptCatalog(current,{...current,products:[]}));
 assert.throws(()=>acceptCatalog(current,{...current,products:[current.products[0],current.products[0]]}));
 assert.throws(()=>acceptCatalog(current,{...current,generatedAt:'2020-01-01T00:00:00Z'}));
 assert.equal(acceptCatalog(current,current).products.length,current.products.length);
});
test('Patched Metro reads original PNG and JPEG assets with the fixed image parser',async()=>{
 const req=createRequire(import.meta.url);const metro=req(resolve('node_modules/metro/src/Assets.js'));
 for(const name of ['asics-contend10.png','nike-zoomfly6.jpg']){
  const path=resolve('assets/catalog',name);const data=await metro.getAssetData(path,'assets/catalog/'+name,[],'android','/assets');
  assert(data.width>0&&data.height>0);
 }
});
