import {isIP} from 'node:net';

// Explicit observed supplier hosts only. A host here does not approve a product
// identity: the owner catalog remains the exact URL allowlist for every request.
export const PHOTO_HOSTS = new Set(['static.nike.com','d26wss9rw703v0.cloudfront.net','assets.adidas.com','media.au.hoka.com','s3.ap-southeast-2.amazonaws.com','nb.scene7.com','topoathletic.com.au','cdn.shopify.com','images.ctfassets.net','ecimg.cafe24img.com','images.puma.com','emea.mizuno.com','res.cloudinary.com','images.asics.com','nmp.about.nike.com','www.altrarunning.com','us.karhu.com','www.decathlon.com','salomon.co.kr']);
export const FRAME_METHOD = 'supplier-column-background-conservative-v1';
export function publicAddress(address) {
  if(isIP(address)===4){
    const [a,b]=address.split('.').map(Number);
    return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===0||b===168))||(a===198&&(b===18||b===19||b===51))||(a===203&&b===0));
  }
  if(isIP(address)===6)return /^[23]/i.test(address)&&!/^2001:(?:db8|0*0):/i.test(address)&&!/^2002:/i.test(address);
  return false;
}
export function approvedPhotoURL(value, declared) {
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&!u.hash&&PHOTO_HOSTS.has(u.hostname)&&declared.has(value);}catch{return false;}
}
const maxDelta=(a,b)=>Math.max(...a.map((v,c)=>Math.abs(v-b[c])));
const backgroundDelta=(a,b)=>a[3]<12&&b[3]<12?0:maxDelta(a,b);
const median=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)];
export function analyzeProductFrame({data,width,height}) {
  const contain=reason=>({status:'contain',reason,width,height,bounds:null});
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<40||height<40||width*height>16000000||data?.length!==width*height*4)return contain('invalid-or-oversize-bitmap');
  const pixel=(x,y)=>{const i=(y*width+x)*4;return [data[i],data[i+1],data[i+2],data[i+3]];};
  // A common Nike original has a central white column and gray outer columns.
  // Estimate each column from BOTH untouched borders, not just four corners.
  const columns=[];let transparent=0, transitions=0;
  const border=Math.max(2,Math.floor(height*.015));
  for(let x=0;x<width;x++){
    const top=[],bottom=[];
    for(let y=0;y<border;y++){top.push(pixel(x,y));bottom.push(pixel(x,height-1-y));}
    const t=[0,1,2,3].map(c=>median(top.map(p=>p[c]))),b=[0,1,2,3].map(c=>median(bottom.map(p=>p[c])));
    if(backgroundDelta(t,b)>8||top.concat(bottom).some(p=>backgroundDelta(p,t)>13))return contain('nonuniform-top-bottom-border');
    if(t[3]<12)transparent++;else if(t[3]<245||Math.min(...t.slice(0,3))<180||Math.max(...t.slice(0,3))-Math.min(...t.slice(0,3))>18)return contain('nonneutral-or-partial-background');
    if(x&&backgroundDelta(t,columns[x-1])>8)transitions++;
    columns.push(t);
  }
  if(transitions>8||(transparent&&transparent!==width))return contain('complex-background');
  const rows=[];
  const sideBorder=Math.max(2,Math.floor(width*.015));
  for(let y=0;y<height;y++){
    if(transparent===width){rows.push([0,0,0,0]);continue;}
    const left=[],right=[];for(let x=0;x<sideBorder;x++){left.push(pixel(x,y));right.push(pixel(width-1-x,y));}
    const a=[0,1,2,3].map(c=>median(left.map(p=>p[c]))),b=[0,1,2,3].map(c=>median(right.map(p=>p[c])));
    if(backgroundDelta(a,b)>8||left.concat(right).some(p=>backgroundDelta(p,a)>13))return contain('nonuniform-left-right-border');
    if(!transparent&&(a[3]<245||Math.min(...a.slice(0,3))<180||Math.max(...a.slice(0,3))-Math.min(...a.slice(0,3))>18))return contain('nonneutral-side-background');
    rows.push(a);
  }
  const rowBaseline=[0,1,2].map(c=>(rows[0][c]+rows[height-1][c])/2);
  let left=width,top=height,right=-1,bottom=-1,count=0,strong=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=pixel(x,y),bg=columns[x],expected=bg.slice(0,3).map((v,c)=>Math.max(0,Math.min(255,v+rows[y][c]-rowBaseline[c]))),d=bg[3]<12?p[3]:maxDelta(p.slice(0,3),expected);
    // Low threshold deliberately retains pale uppers, heel tips and soft shadows.
    if(d<7)continue;
    count++;if(d>=25)strong++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  if(count<width*height*.015||strong<width*height*.006||right-left<width*.30||bottom-top<height*.10)return contain('insufficient-separable-foreground');
  if(transitions&&strong/count<.15)return contain('pale-product-on-multiple-backgrounds');
  if(!transparent&&(left<width*.015||right>width*.985||top<height*.015||bottom>height*.985))return contain('foreground-near-border');
  const padX=Math.ceil(width*.05),padY=Math.ceil(height*.075);
  left=Math.max(0,left-padX);right=Math.min(width-1,right+padX);top=Math.max(0,top-padY);bottom=Math.min(height-1,bottom+padY);
  if((right-left+1)*(bottom-top+1)>width*height*.90)return contain('near-full-canvas');
  // Bounds are DISPLAY METADATA only. Never resample/save altered source bytes.
  const middle=columns[Math.floor(width/2)],background=transparent?null:'#'+middle.slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('');
  return {status:'bounded',reason:'separable-neutral-column-background',width,height,bounds:{width,height,x:left,y:top,cropWidth:right-left+1,cropHeight:bottom-top+1,background},foregroundFraction:count/(width*height),backgroundColumnTransitions:transitions};
}
export function frameMatchesProduct(frame,p,now=Date.now()) {
  return !!frame&&frame.sha256===p.imageSha256&&frame.imageSource===p.imageSource&&frame.productSource===p.source&&/^[a-f0-9]{64}$/.test(frame.sha256)&&Number.isFinite(Date.parse(frame.checkedAt))&&Date.parse(frame.checkedAt)<=now&&now-Date.parse(frame.checkedAt)<=7*86400000&&['width','height','x','y','cropWidth','cropHeight'].every(k=>Number.isSafeInteger(frame[k]))&&frame.width>=40&&frame.height>=40&&frame.width*frame.height<=16000000&&frame.x>=0&&frame.y>=0&&frame.cropWidth>=frame.width*.30&&frame.cropHeight>=frame.height*.10&&frame.x+frame.cropWidth<=frame.width&&frame.y+frame.cropHeight<=frame.height&&(frame.background===null||/^#[a-f0-9]{6}$/i.test(frame.background));
}
export function exactFrameForProduct(candidate,p,now=Date.now()) {
  if(!frameMatchesProduct(candidate,p,now))return null;
  return Object.fromEntries(['sha256','imageSource','productSource','width','height','x','y','cropWidth','cropHeight','background','checkedAt'].map(k=>[k,candidate[k]]));
}
export function buildFrameRecord(product,result) {
  if(result.status!=='bounded'||result.sha256!==product.imageSha256||result.imageSource!==product.imageSource)return null;
  return {sha256:result.sha256,imageSource:product.imageSource,productSource:product.source,...result.bounds,checkedAt:result.checkedAt};
}
