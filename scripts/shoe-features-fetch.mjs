import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import robotsParser from 'robots-parser';
export const USER_AGENT='RunningBomFeatureAudit/1.0 (+https://robom.kr)';
export function publicAddress(ip){
 if(isIP(ip)===4){const a=ip.split('.').map(Number);return !(a[0]===0||a[0]===10||a[0]===127||a[0]>=224||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&(a[1]===168||a[1]===0||a[1]===2)||a[0]===198&&(a[1]===18||a[1]===19||a[1]===51)||a[0]===203&&a[1]===0&&a[2]===113||a[0]===100&&a[1]>=64&&a[1]<=127);}
 if(isIP(ip)===6)return /^2[0-9a-f]{3}:/i.test(ip)&&!/^2001:(?:db8|0:|10:|20:)/i.test(ip);
 return false;
}
export async function boundedOfficialGet(raw,{allowedHosts,timeoutMs=15000,byteCap=8_000_000}={}){
 const u=new URL(raw);
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||!allowedHosts?.has(u.hostname)||isIP(u.hostname))throw Error('unapproved-public-source');
 const start=Date.now(),addresses=await Promise.race([lookup(u.hostname,{all:true}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('dns-timeout')),timeoutMs);t.unref();})]);
 if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error('non-public-dns');
 const chosen=addresses.find(a=>a.family===4)||addresses[0];
 return new Promise((resolve,reject)=>{
  const req=https.get(u,{headers:{'user-agent':USER_AGENT,accept:'text/html,application/xhtml+xml,text/plain','accept-encoding':'identity'},lookup:(_host,options,callback)=>options?.all?callback(null,[chosen]):callback(null,chosen.address,chosen.family)},res=>{
   const chunks=[];let bytes=0;
   if(res.statusCode>=300&&res.statusCode<400){res.resume();resolve({status:res.statusCode,location:res.headers.location,body:'',bytes:0,contentType:res.headers['content-type']||'',elapsedMs:Date.now()-start});return;}
   if(Number(res.headers['content-length']||0)>byteCap){res.destroy();reject(Error('response-size-cap'));return;}
   res.on('data',b=>{bytes+=b.length;if(bytes>byteCap){res.destroy(Error('response-size-cap'));return;}chunks.push(b);});
   res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8'),bytes,contentType:res.headers['content-type']||'',retryAfter:res.headers['retry-after']||'',elapsedMs:Date.now()-start}));
  });
  const timer=setTimeout(()=>req.destroy(Error('request-timeout')),Math.max(1,timeoutMs-(Date.now()-start)));timer.unref();
  req.on('close',()=>clearTimeout(timer));req.on('error',reject);
 });
}
export function officialFeatureClient({allowedHosts,get=boundedOfficialGet,state={},onState=()=>{}}={}){
 const robots=new Map(),last=new Map(),queues=new Map(),cooldown=new Map(Object.entries(state.cooldowns||{}));
 async function pacedGet(url,options){
  const origin=new URL(url).origin;
  const prior=queues.get(origin)||Promise.resolve();let release;
  const done=new Promise(resolve=>{release=resolve;});queues.set(origin,prior.catch(()=>{}).then(()=>done));await prior.catch(()=>{});
  try{
  const wait=Math.max(0,750-(Date.now()-(last.get(origin)||0)));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));last.set(origin,Date.now());
  if((cooldown.get(origin)||0)>Date.now())throw Error('origin-cooldown-after-429');
  const result=await get(url,options);
  if(result.status===429){const seconds=Number(result.retryAfter),until=Number.isFinite(seconds)&&seconds>0?Date.now()+seconds*1000:Date.parse(result.retryAfter)||Date.now()+300000;cooldown.set(origin,Math.max(Date.now()+750,until));await onState({cooldowns:Object.fromEntries(cooldown),updatedAt:new Date().toISOString()});}
  return result;
  }finally{release();}
 }
 async function policy(origin){
  if(!robots.has(origin))robots.set(origin,(async()=>{
   try{let url=origin+'/robots.txt',r;
    for(let hops=0;hops<3;hops++){
     r=await pacedGet(url,{allowedHosts,byteCap:512000});
     if(r.status<300||r.status>=400)break;
     const next=new URL(r.location||'',url);
     if(next.protocol!=='https:'||!allowedHosts.has(next.hostname)||next.pathname!=='/robots.txt')throw Error('robots-redirect-outside-approved-source');
     url=next.href;
    }
    if(r.status===404)return {ok:true,reason:'robots-404'};
    if(r.status!==200)return {ok:false,reason:'robots-http-'+r.status};
    const parser=robotsParser(origin+'/robots.txt',r.body);return {ok:true,parser};
   }catch(e){return {ok:false,reason:'robots-unavailable:'+e.message};}
  })());return robots.get(origin);
 }
 const read=async(url,hops=0)=>{
  const u=new URL(url),p=await policy(u.origin);
  if(!p.ok)throw Error(p.reason);
  if(p.parser?.isAllowed(url,USER_AGENT)===false)throw Error('robots-disallowed');
  const delay=Math.max(750,Number(p.parser?.getCrawlDelay(USER_AGENT)||0)*1000);
  if(delay>15000)throw Error('robots-crawl-delay-exceeds-budget');
  if(delay>750)await new Promise(r=>setTimeout(r,delay-750));
  const result=await pacedGet(url,{allowedHosts});
  if(result.status>=300&&result.status<400){
   const next=new URL(result.location||'',url);
   if(hops>=2||next.protocol!=='https:'||!allowedHosts.has(next.hostname)||next.username||next.password)throw Error('redirect-outside-approved-source');
   return read(next.href,hops+1);
  }
  if(result.status!==200)throw Error('product-http-'+result.status);
  if(!/text\/html|application\/xhtml\+xml/i.test(result.contentType))throw Error('product-not-html');
  // A normal storefront can load reCAPTCHA for checkout; the word "captcha"
  // inside a script is not an access denial. Refuse actual challenge documents,
  // never solve a challenge or retry with a different identity/proxy.
  const title=result.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';
  const h1=result.body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]*>/g,'')||'';
  if(/access denied|attention required!|just a moment|verify you are human|captcha|보안 확인/i.test(title+' '+h1)||/id=["']challenge-running["']/.test(result.body.slice(0,20000)))throw Error('access-challenge');
  return {...result,finalUrl:url};
 };
 return read;
}
