import test from 'node:test';import assert from 'node:assert/strict';
import {withImageOwnership,checkImageOwnership,retainExactImageFrame} from './catalog-image-ownership.mjs';
const p={brand:'NIKE',model:'ACG 울트라플라이 트레일',source:'https://www.nike.com/kr/t/official/HF5668-401',sku:'HF5668-401',color:'레이서 블루',imageSource:'https://static.nike.com/a/images/exact/NIKE+ACG+ULTRAFLY+TRAIL.png'};
test('same official model/SKU/color/source object is mandatory; cross-color and cross-model image joins fail',()=>{
 const row=withImageOwnership(p,p.source,'schema.org');assert.equal(checkImageOwnership(row).ok,true);
 for(const change of [{sku:'HF5668-601'},{color:'하이퍼 핑크'},{source:p.source.replace('401','601')},{model:'Vaporfly 4'},{imageSource:'https://static.nike.com/a/images/OTHER.png'}])assert.equal(checkImageOwnership({...row,...change}).ok,false);
 assert.equal(checkImageOwnership(p).ok,false);
 const bad=withImageOwnership({...p,imageSource:'https://static.nike.com/a/images/W+NIKE+VAPORFLY+4+FK.png'},p.source,'schema.org');assert.equal(checkImageOwnership(bad).ok,false);
 const wrongColorUrl=withImageOwnership({...p,source:p.source.replace('401','601')},p.source,'schema.org');assert.equal(checkImageOwnership(wrongColorUrl).ok,false);
});
test('exact matching frame keeps its actual audit date; hash/URL/product/crop/expiry changes invalidate it',()=>{
 const now=Date.parse('2026-10-24T00:00:00Z'),sha='a'.repeat(64),frame={sha256:sha,imageSource:p.imageSource,productSource:p.source,width:1000,height:1000,x:50,y:100,cropWidth:900,cropHeight:800,background:'#ffffff',checkedAt:'2026-10-23T00:00:00Z'},row={...p,imageSha256:sha,imageFrame:frame};
 assert.deepEqual(retainExactImageFrame(row,now).imageFrame,frame);
 for(const patch of [{imageSource:'https://static.nike.com/different.png'},{productSource:p.source+'?size=8'},{sha256:'b'.repeat(64)},{x:-1},{cropWidth:1001},{checkedAt:'2026-10-01T00:00:00Z'},{checkedAt:'2026-11-01T00:00:00Z'}])assert.equal(retainExactImageFrame({...row,imageFrame:{...frame,...patch}},now).imageFrame,undefined);
 assert.equal(retainExactImageFrame({...row,imageSha256:'b'.repeat(64)},now).imageFrame,undefined);
});
