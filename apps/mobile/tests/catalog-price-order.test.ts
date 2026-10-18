import test from 'node:test';import assert from 'node:assert/strict';
import {compareShoePrices} from '../domains/catalog/contracts';
test('높은 가격순에서도 미확인 가격을 가장 비싸다고 표시하지 않고 통화를 나눈다',()=>{
 const rows=[{price:null,currency:'KRW'},{price:100000,currency:'KRW'},{price:200000,currency:'KRW'},{price:100,currency:'USD'}];
 assert.deepEqual([...rows].sort((a,b)=>compareShoePrices(a,b,true)).map(p=>p.price),[200000,100000,null,100]);
 assert.deepEqual([...rows].sort((a,b)=>compareShoePrices(a,b,false)).map(p=>p.price),[100000,200000,null,100]);
});
