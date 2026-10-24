// Exact supplier URLs only. Robots + pinned public DNS + one request per host.
// No redirects/proxies/accounts. This client returns ORIGINAL bytes, never crops.
import https from 'node:https';import {lookup} from 'node:dns/promises';
import robotsParser from 'robots-parser';
import {publicAddress,approvedPhotoURL} from './product-frame-audit-core.mjs';
const agent='RunningbomPhotoFrameAudit';
export async function boundedImageRequest(url,{byteCap=10*1024*1024,robots=false}={}){
 const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443')throw Error('unapproved HTTPS URL');
 const rows=await Promise.race([lookup(u.hostname,{all:true}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('DNS timeout')),4000);t.unref();})]);
 if(!rows.length||rows.some(r=>!publicAddress(r.address)))throw Error('Unsafe DNS answer');const selected=rows.find(r=>r.family===4)||rows[0];
 return new Promise((resolve,reject)=>{
  const req=https.get(u,{lookup:(_h,o,cb)=>o.all?cb(null,[selected]):cb(null,selected.address,selected.family),headers:{'user-agent':agent+'/1.0 (+https://robom.kr)',accept:robots?'text/plain':'image/png,image/jpeg,image/webp,image/avif;q=0.5','accept-encoding':'identity'}},res=>{
   const meta={status:res.statusCode,contentType:String(res.headers['content-type']||'').split(';')[0],retryAfter:res.headers['retry-after']||''};
   if(res.statusCode!==200){res.resume();resolve({...meta,bytes:Buffer.alloc(0)});return;}
   if(!robots&&!/^image\/(png|jpeg|webp|avif|gif)$/.test(meta.contentType)){res.destroy();reject(Error('Unsupported image type'));return;}
   if(Number(res.headers['content-length']||0)>byteCap){res.destroy();reject(Error('Body size cap'));return;}
   let n=0;const chunks=[];res.on('data',c=>{n+=c.length;if(n>byteCap)res.destroy(Error('Body size cap'));else chunks.push(c);});res.on('end',()=>resolve({...meta,bytes:Buffer.concat(chunks)}));res.on('error',reject);
  });const t=setTimeout(()=>req.destroy(Error('Image timeout 15s')),15000);t.unref();req.on('close',()=>clearTimeout(t));req.on('error',reject);
 });
}
export function officialImageClient({declared,get=boundedImageRequest,state={},onState=()=>{}}){
 const robots=new Map(),queues=new Map(),last=new Map(),cooldowns=new Map(Object.entries(state.cooldowns||{}));
 async function paced(url,options={},delay=1000){
  const host=new URL(url).hostname,prior=queues.get(host)||Promise.resolve();let release;const done=new Promise(r=>{release=r;});queues.set(host,prior.catch(()=>{}).then(()=>done));await prior.catch(()=>{});
  try{if((cooldowns.get(host)||0)>Date.now())throw Error('image-host-cooldown');const wait=Math.max(0,delay-(Date.now()-(last.get(host)||0)));if(wait)await new Promise(r=>setTimeout(r,wait));last.set(host,Date.now());
   const response=await get(url,options);if(response.status===429){const seconds=Number(response.retryAfter),until=Number.isFinite(seconds)&&seconds>0?Date.now()+seconds*1000:Date.parse(response.retryAfter)||Date.now()+3600000;cooldowns.set(host,until);await onState({cooldowns:Object.fromEntries(cooldowns)});}return response;
  }finally{release();}
 }
 return async url=>{
  if(!approvedPhotoURL(url,declared))throw Error('Image not in exact approved input');const host=new URL(url).hostname;
  if(!robots.has(host))robots.set(host,(async()=>{const robotURL='https://'+host+'/robots.txt',r=await paced(robotURL,{robots:true,byteCap:512000});if(![200,404].includes(r.status))throw Error('image-robots-http-'+r.status);return robotsParser(robotURL,r.bytes.toString('utf8'));})());
  const parser=await robots.get(host);if(parser.isAllowed(url,agent)===false)throw Error('image-robots-disallow');const delay=Math.max(1000,Number(parser.getCrawlDelay(agent)||1)*1000);if(delay>60000)throw Error('image-robots-delay-over-budget');
  const r=await paced(url,{},delay);if(r.status!==200)throw Error('image-http-'+r.status);return {...r,checkedAt:new Date().toISOString()};
 };
}
