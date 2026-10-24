import test from 'node:test';import assert from 'node:assert/strict';
import {exactPhotoAssociation,sourcePhotoProof} from './catalog-photo-source-audit.mjs';
const p={id:'a',brand:'Brooks',model:'Ghost 18',sku:'123',color:'Blue',currency:'AUD',sourceRegion:'호주',source:'https://brooksrunning.com.au/p?size=9',imageSource:'https://res.cloudinary.com/x.avif'};
const row={...p,knownCatalogId:'a',imageOwnership:{schemaVersion:1,kind:'schema.org-product-object',productSource:p.source,sku:p.sku,model:p.model,color:p.color,imageSource:p.imageSource}};
test('photo hash approval requires exact same official SKU/color/market/image object, not a shared model name',()=>{
 assert.equal(exactPhotoAssociation(p,row),true);
 for(const key of ['knownCatalogId','source','sku','imageSource','color','currency','sourceRegion','brand'])assert.equal(exactPhotoAssociation(p,{...row,[key]:'wrong'}),false,key);
 assert.equal(exactPhotoAssociation(p,{...row,imageOwnership:null}),false);
});
test('cached association preserves real source SHA/date; expired or unverifiable documents cannot approve hashes',()=>{
 const m={url:p.source,sha256:'a'.repeat(64),checkedAt:new Date().toISOString()};
 assert.equal(sourcePhotoProof(p,row,m).checkedAt,m.checkedAt);
 assert.equal(sourcePhotoProof(p,row,{...m,sha256:'no'}),null);
 assert.equal(sourcePhotoProof(p,row,{...m,checkedAt:'2000-01-01'}),null);
});
