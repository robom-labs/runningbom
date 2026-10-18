import test from 'node:test';import assert from 'node:assert/strict';import{filterProducts}from'../src/features/product-filter.ts';
const filters={purpose:'전체',brand:'전체',budget:'전체',query:'',view:'전체',sort:'기본순',use:'전체',favorites:[]};
const base={brand:'NIKE',name:'Runner',model:'Runner',sku:null,purpose:'입문·매일 러닝',uses:['daily'],currency:'KRW',price:99000,checkedAt:'2026-10-18T00:00:00Z',release:'',upcoming:false};
test('latest requires a confirmed release in the last year; collection time cannot imply a launch',()=>{
 const rows=filterProducts([{...base,id:'unknown'},{...base,id:'dated',release:'2026-09-17'},{...base,id:'old',release:'2024-09-17'},{...base,id:'future',release:'2027-01',upcoming:true}],{...filters,view:'최신'},new Date('2026-10-18T00:00:00Z'));
 assert.deepEqual(rows.map(x=>x.id),['dated']);
});
test('upcoming is ordered by the next declared launch, not collection arrival',()=>{
 const rows=filterProducts([{...base,id:'feb',release:'2027-02',upcoming:true},{...base,id:'jan',release:'2027-01',upcoming:true}],{...filters,view:'출시 예정'});assert.deepEqual(rows.map(x=>x.id),['jan','feb']);
});
test('unannounced prices are filterable and never counted as affordable prices',()=>{
 const rows=[{...base,id:'unknown-price',price:null,currency:'XXX',upcoming:true,release:'2027-01'},{...base,id:'known-price'}];
 assert.deepEqual(filterProducts(rows,{...filters,budget:'가격 미정'}).map(p=>p.id),['unknown-price']);
 assert.deepEqual(filterProducts(rows,{...filters,budget:'10만원 이하'}).map(p=>p.id),['known-price']);
});
test('foreign list prices are not treated as Korean won in budget filtering',()=>{
 assert.equal(filterProducts([{...base,id:'foreign',price:150,currency:'USD'}],{...filters,budget:'10만원 이하'}).length,0);
});
