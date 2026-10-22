import test from 'node:test';import assert from 'node:assert/strict';
import {publicationFields} from './catalog-publication-core.mjs';
test('scheduled ingestion removes unavailable display fields without altering product identity, price or photo',()=>{
 const row={id:'sku-123',sku:'123',source:'https://official.example/product/123',imageSha256:'abc',price:null,category:'daily',gender:'미공개',plate:'공식 사양 확인 필요',drop:'0mm',weight:'317g · 어떤 사이즈인지는 안내 없음',releaseRegion:'중국 선출시 · 한국 미정'};
 const next=publicationFields(row);assert.equal(next.plate,'');assert.equal(next.gender,'');assert.equal(next.weight,'317g');assert.equal(next.drop,'0mm');assert.equal(next.releaseRegion,'중국 선출시');
 for(const key of ['id','sku','source','imageSha256','price'])assert.equal(next[key],row[key]);
});
