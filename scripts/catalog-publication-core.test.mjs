import test from 'node:test';import assert from 'node:assert/strict';
import {publicationFields} from './catalog-publication-core.mjs';
test('scheduled ingestion removes unavailable display fields without altering product identity, price or photo',()=>{
 const row={id:'sku-123',sku:'123',source:'https://official.example/product/123',imageSha256:'abc',price:null,category:'daily',gender:'미공개',plate:'공식 사양 확인 필요',drop:'0mm',weight:'317g · 어떤 사이즈인지는 안내 없음',releaseRegion:'중국 선출시 · 한국 미정'};
 const next=publicationFields(row);assert.equal(next.plate,'');assert.equal(next.gender,'');assert.equal(next.weight,'317g');assert.equal(next.drop,'0mm');assert.equal(next.releaseRegion,'중국 선출시');
 for(const key of ['id','sku','source','imageSha256','price'])assert.equal(next[key],row[key]);
});
test('Unknown roles retain generic running-shoe labels through publication, never stale stability labels',()=>{
 const row={id:'unknown-variant',category:'unknown',purpose:'탄탄한 지지',tier:'탄탄한 지지',price:100,sku:null,checkedAt:'2026-10-22T04:49:40.535Z'};
 const next=publicationFields(row);assert.equal(next.purpose,'러닝화');assert.equal(next.tier,'러닝화');for(const key of ['id','price','sku','checkedAt'])assert.equal(next[key],row[key]);
});
