import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyzeProductFrame,approvedPhotoURL,publicAddress,buildFrameRecord,frameMatchesProduct,exactFrameForProduct} from './product-frame-audit-core.mjs';
function fixture({striped=false,white=false,transparent=false,shadow=false}={}){
 const width=200,height=200,data=Buffer.alloc(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4,v=striped&&(x<50||x>=150)?242:255;data.set([v,v,v,transparent?0:255],i);}
 function rect(x0,y0,x1,y1,v,a=255){for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)data.set([v,v,v,a],(y*width+x)*4);}
 rect(35,75,165,130,white?240:65);if(white)rect(40,127,160,132,170);if(shadow)rect(29,132,173,140,246);
 return {data,width,height};
}
test('white and gray stripe canvases preserve toe heel and soft shadow without mutating bytes',()=>{
 for(const striped of [false,true])for(const white of [false,true]){const f=fixture({striped,white,shadow:true}),before=Buffer.from(f.data),r=analyzeProductFrame(f);if(striped&&white)assert.equal(r.status,'contain');else{assert.equal(r.status,'bounded');assert.ok(r.bounds.x<=29&&r.bounds.x+r.bounds.cropWidth>=173);assert.ok(r.bounds.y<=75&&r.bounds.y+r.bounds.cropHeight>=140);}assert.deepEqual(f.data,before);}
});
test('transparent source gets conservative alpha bounds',()=>{assert.equal(analyzeProductFrame(fixture({transparent:true})).status,'bounded');});
test('transparent border RGB garbage cannot become imaginary foreground',()=>{const f=fixture({transparent:true});for(let i=0;i<f.data.length;i+=4)if(f.data[i+3]===0){f.data[i]=(i*13)%256;f.data[i+1]=(i*19)%256;}assert.equal(analyzeProductFrame(f).status,'bounded');});
test('pure transparent canvas with a wide shoe retains full image width, never cuts a toe at the border',()=>{const f=fixture({transparent:true});for(let y=75;y<130;y++)for(let x=1;x<199;x++)f.data.set([80,80,80,255],(y*200+x)*4);const r=analyzeProductFrame(f);assert.equal(r.status,'bounded');assert.equal(r.bounds.x,0);assert.equal(r.bounds.cropWidth,200);});
test('symmetric gray-white-gray supplier gradient keeps shoe bounds rather than the entire canvas',()=>{
 const f=fixture();for(let y=0;y<200;y++)for(let x=0;x<200;x++){const i=(y*200+x)*4;if(f.data[i]===255){const v=240+Math.round(15*Math.sin(Math.PI*y/199));f.data.set([v,v,v,255],i);}}
 const r=analyzeProductFrame(f);assert.equal(r.status,'bounded');assert.ok(r.bounds.x<=35&&r.bounds.x+r.bounds.cropWidth>=165);
});
test('uncertain very white product and photograph backgrounds stay contain',()=>{
 const f=fixture();f.data.fill(255);assert.equal(analyzeProductFrame(f).status,'contain');
 const g=fixture();g.data[0]=0;assert.equal(analyzeProductFrame(g).status,'contain');
 const near=fixture();near.data.set([0,0,0,255],(100*200)*4);assert.equal(analyzeProductFrame(near).status,'contain');
});
test('invalid bitmap and overlarge dimensions fail closed',()=>{assert.equal(analyzeProductFrame({data:[],width:5000,height:5000}).status,'contain');});
test('exact URL list, https, no redirect target invention or credentials',()=>{
 const url='https://static.nike.com/a/test.png',allowed=new Set([url]);assert.ok(approvedPhotoURL(url,allowed));for(const u of ['http://static.nike.com/a/test.png','https://static.nike.com.evil/a/test.png','https://u:p@static.nike.com/a/test.png',url+'?other=1','https://127.0.0.1/x'])assert.equal(approvedPhotoURL(u,allowed),false);
});
test('public address policy rejects private, link-local, mapped, documentation and multicast',()=>{
 for(const a of ['127.0.0.1','10.0.0.1','100.64.1.1','169.254.1.1','172.31.1.1','192.168.1.1','198.18.0.1','224.0.0.1','::1','::ffff:8.8.8.8','fe80::1','fc00::1','2001:db8::1','2002::1'])assert.equal(publicAddress(a),false,a);
 assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
});
test('new color or same URL new hash invalidates frame; TTL never extends observation',()=>{
 const p={source:'https://www.nike.com/p/one',imageSource:'https://static.nike.com/a/a.png',imageSha256:'a'.repeat(64)},checkedAt='2026-10-24T00:00:00Z';
 const r=buildFrameRecord(p,{status:'bounded',sha256:p.imageSha256,imageSource:p.imageSource,checkedAt,bounds:{width:200,height:200,x:20,y:40,cropWidth:160,cropHeight:100,background:'#ffffff'}});
 assert.ok(frameMatchesProduct(r,p,Date.parse(checkedAt)+86400000));
 for(const changed of [{...p,imageSha256:'b'.repeat(64)},{...p,imageSource:p.imageSource+'?new=1'},{...p,source:p.source+'-new'}])assert.equal(frameMatchesProduct(r,changed,Date.parse(checkedAt)),false);
 assert.equal(frameMatchesProduct(r,p,Date.parse(checkedAt)+8*86400000),false);
 assert.equal(buildFrameRecord({...p,imageSha256:'b'.repeat(64)},{status:'bounded',sha256:p.imageSha256,imageSource:p.imageSource}),null);
 assert.equal(exactFrameForProduct({...r,x:-1},p,Date.parse(checkedAt)),null);
 assert.equal(exactFrameForProduct({...r,cropWidth:201},p,Date.parse(checkedAt)),null);
 assert.equal(exactFrameForProduct({...r,background:'url(evil)'},p,Date.parse(checkedAt)),null);
 assert.deepEqual(exactFrameForProduct({...r,identityVerified:false,extra:'ignored'},p,Date.parse(checkedAt)),r);
});
