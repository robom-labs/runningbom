import test from'node:test';import assert from'node:assert/strict';import{interestFromPage,mapInterest}from'./shoe-interest-core.mjs';
test('published view counts are decoded, not the source recommendation or score order',()=>{
 const d=[{product_id:1,name:2,slug:3,views:4,score:5},22,'Nike Pegasus 42','nike-pegasus-42',15000,80];
 const result=interestFromPage(`<script id="__NUXT_DATA__">${JSON.stringify(d)}</script><a href="https://runrepeat.com/catalog/running-shoes?page=2">Next</a><a href="https://runrepeat.com/catalog/running-shoes?order_by=popularity">No crawler sort URL</a>`,'https://runrepeat.com/catalog/running-shoes');
 assert.equal(result.rows[0].views,15000);assert.equal(result.next.length,1);
});
test('only exact brand/model matches receive measured ranks; unknown models never do',()=>{
 const rows=mapInterest([{id:'a',brand:'NIKE',modelEn:'Pegasus 42'},{id:'b',brand:'ASICS',modelEn:'Novablast 5'},{id:'unmatched',brand:'ASICS',modelEn:'Novablast 6'}],[{name:'Nike Pegasus 42',views:12,url:'https://runrepeat.com/a'},{name:'ASICS Novablast 5',views:30,url:'https://runrepeat.com/b'}]);assert.equal(rows.find(p=>p.item_id==='b').rank,1);assert.equal(rows.length,2);
});
