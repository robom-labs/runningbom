import test from 'node:test';import assert from 'node:assert/strict';import {assessCatalogCandidate} from './catalog-refresh-guard.mjs';
const now=Date.parse('2026-10-22T00:00:00Z');
const row={checkedAt:'2026-10-21T00:00:00Z',source:'https://brand.example/shoe',imageSource:'https://brand.example/shoe.jpg'};
const previous={schemaVersion:1,generatedAt:row.checkedAt,products:Array.from({length:10},(_,i)=>({...row,id:String(i)}))};
test('catalog publication guard quarantines drop, duplicate identity, date and provenance errors',()=>{
 assert.equal(assessCatalogCandidate(previous,previous,now).ok,true);
 for(const next of [{...previous,products:previous.products.slice(0,5)},{...previous,products:[...previous.products,previous.products[0]]},{...previous,generatedAt:'2027-01-01T00:00:00Z'},{...previous,products:[{...row,id:'x',checkedAt:'invalid'}]},{...previous,products:[{...row,id:'x',source:'https://user:password@brand.example'}]}])assert.equal(assessCatalogCandidate(previous,next,now).ok,false);
});
