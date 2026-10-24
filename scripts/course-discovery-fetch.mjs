import{request}from'node:https';import{lookup}from'node:dns/promises';import{isIP}from'node:net';import{load}from'cheerio';import{safeCourseURL,courseDirectoryHost,courseDigest}from'./course-discovery-core.mjs';
export const COURSE_DISCOVERY_LIMITS=Object.freeze({maxRequests:24,maxBytes:24000000,maxBodyBytes:2000000,maxAssetBytes:4000000,maxRedirects:3,maxRunMs:240000,timeoutMs:10000,minHostGapMs:700});
// Navigation wrappers are not edition evidence. Only explicit immediate/short
// same-origin HTML refreshes are traversed; no JS execution or guessed /ko path.
export function courseMetaRefreshTarget(html,url){
 const $=load(html),targets=[];
 $('head meta[http-equiv]').each((_,el)=>{const n=$(el);if(String(n.attr('http-equiv')).trim().toLowerCase()!=='refresh')return;
  const m=String(n.attr('content')||'').match(/^\s*[0-5](?:\.0+)?\s*;\s*url\s*=\s*(?:"([^"]+)"|'([^']+)'|([^"']+))\s*$/i);
  if(!m)throw Error('unsupported-meta-refresh');const next=safeCourseURL((m[1]||m[2]||m[3]).trim(),url);
  if(!next||new URL(next).origin!==new URL(url).origin)throw Error('unsafe-cross-origin-meta-refresh');targets.push(next);
 });
 if(new Set(targets).size>1)throw Error('ambiguous-meta-refresh');return targets[0]||null;
}
export function publicCourseIP(address){if(isIP(address)===4)return!(/^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|198\.(1[89])\.|22[4-9]\.|23\d\.|24\d\.|25[0-5]\.)/).test(address);return isIP(address)===6&&!/^([:]|f[cd]|ff|fe[89ab]|2001:db8)/i.test(address);}
// HTTPS is pinned to the public addresses checked above; fetch's second DNS lookup
// cannot silently redirect a public organizer hostname to a private address.
export function courseHTTPSRequest(url,{addresses,timeoutMs,maxBytes,onBytes}){
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>req.destroy(Error('request-timeout')),timeoutMs);
  const req=request(url,{method:'GET',headers:{'user-agent':'RunningbomCourseDiscovery/1 (+https://robom.kr; public source metadata)','accept':'text/html,application/gpx+xml,application/xml,image/*;q=0.8'},lookup(_host,options,callback){const a=addresses[0];if(options?.all)callback(null,addresses);else callback(null,a.address,a.family);}},res=>{
   if(Number(res.headers['content-length'])>maxBytes){res.destroy();req.destroy(Error('body-byte-limit'));return;}
   const chunks=[];let length=0;res.on('data',chunk=>{length+=chunk.length;if(onBytes&&onBytes(chunk.length)===false){req.destroy(Error('network-byte-budget'));return;}if(length>maxBytes){req.destroy(Error('body-byte-limit'));return;}chunks.push(chunk);});
   res.on('end',()=>{clearTimeout(timer);resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)});});res.on('error',reject);
  });req.on('error',error=>{clearTimeout(timer);reject(error);});req.end();
 });
}
export function robotsCourseAllowed(text,url){
 const groups=[];let current,hasRules=false;
 for(const raw of text.split(/\r?\n/)){const line=raw.replace(/#.*/,'').trim(),m=line.match(/^([\w-]+)\s*:\s*(.*)$/);if(!m)continue;const key=m[1].toLowerCase(),value=m[2].trim();
  if(key==='user-agent'){if(!current||hasRules){current={agents:[],rules:[]};groups.push(current);hasRules=false;}current.agents.push(value.toLowerCase());}
  else if(current&&['allow','disallow'].includes(key)){hasRules=true;if(value)current.rules.push({allow:key==='allow',path:value});}
 }
 const exact=groups.filter(g=>g.agents.some(a=>a!=='*'&&'runningbomcoursediscovery'.includes(a))),rules=(exact.length?exact:groups.filter(g=>g.agents.includes('*'))).flatMap(g=>g.rules),path=new URL(url).pathname+new URL(url).search;
 const matched=rules.filter(r=>{const regex=r.path.split('*').map(s=>s.replace(/[.+?^${}()|[\]\\]/g,'\\$&')).join('.*').replace(/\\\$$/,'$');try{return new RegExp('^'+regex).test(path);}catch{return false;}}).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));
 return!matched.length||matched[0].allow;
}
export function createCourseSourceRetriever({cache=new Map(),live=false,revalidate=new Set(),boundedLeadRepair=false,now=Date.now,resolveDNS=lookup,requestImpl=courseHTTPSRequest,sleep=ms=>new Promise(r=>setTimeout(r,ms)),limits={}}={}){
 const cap={...COURSE_DISCOVERY_LIMITS,...limits};if(Object.entries(cap).some(([key,n])=>!Number.isSafeInteger(n)||n<(['maxRequests','minHostGapMs'].includes(key)?0:1))||cap.maxRequests>(boundedLeadRepair?76:64)||cap.maxBodyBytes>4000000||cap.maxAssetBytes>(boundedLeadRepair?10000000:8000000)||cap.maxBytes>120000000||cap.maxRunMs>600000)throw Error('Discovery safety budget out of range');
 const started=now(),lastHost=new Map(),robots=new Map(),pending=new Map(),attempts=[];let requests=0,bytes=0,hits=0,reservation=Promise.resolve(),raceBudget=null;const perRace={};
 async function rawGet(url,{kind='page',redirects=0,origin=new URL(url).origin,seen=new Set()}={}){
  if(seen.has(url))throw Error('redirect-loop');seen.add(url);
  if(raceBudget&&(!raceBudget.liveAllowed||raceBudget.used>=raceBudget.maxRequests))throw Error('per-race-network-budget');
  if(requests>=cap.maxRequests||now()-started>cap.maxRunMs||bytes>=cap.maxBytes)throw Error('network-budget');
  const u=new URL(url),addresses=await Promise.race([resolveDNS(u.hostname,{all:true}),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('dns-timeout')),cap.timeoutMs);timer.unref?.();})]);
  if(!addresses.length||addresses.some(a=>!publicCourseIP(a.address)))throw Error('private-or-invalid-dns');
  const slot=reservation.then(async()=>{const gap=Math.max(0,(lastHost.get(u.hostname)??-Infinity)+cap.minHostGapMs-now());if(gap)await sleep(gap);if(raceBudget&&(!raceBudget.liveAllowed||raceBudget.used>=raceBudget.maxRequests))throw Error('per-race-network-budget');if(requests>=cap.maxRequests||now()-started>cap.maxRunMs||bytes>=cap.maxBytes)throw Error('network-budget');lastHost.set(u.hostname,now());requests++;if(raceBudget){raceBudget.used++;perRace[raceBudget.id]=raceBudget.used;}});reservation=slot.catch(()=>{});await slot;
  const maxBytes=Math.min(kind==='image'?cap.maxAssetBytes:kind==='robots'?100000:cap.maxBodyBytes,cap.maxBytes-bytes);let streamed=0;
  const r=await requestImpl(url,{addresses,timeoutMs:cap.timeoutMs,maxBytes,onBytes(n){streamed+=n;bytes+=n;return bytes<=cap.maxBytes;}});
  if(!Buffer.isBuffer(r.body)||r.body.length>maxBytes||(!streamed&&bytes+r.body.length>cap.maxBytes))throw Error('body-byte-limit');if(!streamed)bytes+=r.body.length;
  attempts.push({url,status:r.status,bytes:r.body.length,kind,checkedAt:new Date(now()).toISOString()});
  const html=kind==='page'&&r.status===200&&(/(?:text\/html|application\/xhtml\+xml)/i.test(String(r.headers['content-type']||''))||!r.headers['content-type']&&/^\s*(?:<!doctype\s+html|<html|<head|<meta)\b/i.test(r.body.subarray(0,512).toString('utf8')));
  const next=r.status>=300&&r.status<400?safeCourseURL(r.headers.location,url):html?courseMetaRefreshTarget(r.body.toString('utf8'),url):null;
  if(r.status>=300&&r.status<400||next){if(!next||new URL(next).origin!==origin||redirects>=cap.maxRedirects)throw Error('unsafe-cross-origin-or-excess-redirect');if(kind!=='robots'&&robots.has(origin)&&!robotsCourseAllowed(await robots.get(origin),next))throw Error('robots-disallow');return rawGet(next,{kind,redirects:redirects+1,origin,seen});}
  return{...r,finalUrl:url};
 }
 async function allowed(url){const origin=new URL(url).origin;if(!robots.has(origin))robots.set(origin,(async()=>{const r=await rawGet(origin+'/robots.txt',{kind:'robots'});if(r.status===404)return'';if(r.status!==200)throw Error('robots-unavailable');return r.body.toString('utf8');})());const text=await robots.get(origin);if(!robotsCourseAllowed(text,url))throw Error('robots-disallow');}
 async function get(raw,{kind='page'}={}){
  const url=safeCourseURL(raw);if(!url||courseDirectoryHost(new URL(url).hostname))return{ok:false,requestedUrl:raw,reason:'unsafe-or-nonofficial-url'};
  if(pending.has(url))return pending.get(url);
  const task=(async()=>{const cached=cache.get(url);if(cached&&!revalidate.has(url)){const receipt=await(typeof cached==='function'?cached():cached),age=now()-Date.parse(receipt?.checkedAt);if(receipt&&Number.isFinite(age)&&age>=-300000&&age<=(receipt.ok?7*86400000:6*3600000)&&receipt.verification!=='saved-evidence-rejected'){
    // Old cached wrappers must not suppress discovery for seven days. Revalidate
    // through the same bounded live path; never rejuvenate their checkedAt.
    let wrapper=false;try{wrapper=kind==='page'&&receipt.ok&&!!courseMetaRefreshTarget(receipt.text||receipt.body?.toString('utf8')||'',receipt.finalUrl||url);}catch(error){return{ok:false,requestedUrl:url,reason:error.message,checkedAt:receipt.checkedAt,verification:'saved-evidence-rejected'};}
    if(!wrapper){hits++;return receipt;}
   }}
   if(!live)return{ok:false,requestedUrl:url,reason:'offline-cache-miss'};
   try{await allowed(url);const r=await rawGet(url,{kind});if(r.status!==200)throw Error('http-'+r.status);
    const contentType=String(r.headers['content-type']??''),charset=contentType.match(/charset\s*=\s*([^;\s]+)/i)?.[1]||r.body.subarray(0,4000).toString('ascii').match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]||'utf-8';let text;try{text=new TextDecoder(charset).decode(r.body);}catch{text=r.body.toString('utf8');}
    return{ok:true,requestedUrl:url,finalUrl:r.finalUrl,status:200,contentType,body:r.body,text,sha256:courseDigest(r.body),bytes:r.body.length,checkedAt:new Date(now()).toISOString(),verification:'live-public-https'};
   }catch(error){return{ok:false,requestedUrl:url,reason:error.message,checkedAt:new Date(now()).toISOString(),verification:'live-failed'};}
  })();pending.set(url,task);return task;
 }
 return{get,beginRace(id,{maxRequests=4,liveAllowed=true}={}){if(!Number.isInteger(maxRequests)||maxRequests<0||maxRequests>4)throw Error('Per-race request limit');raceBudget={id,maxRequests,liveAllowed,used:perRace[id]||0};},stats:()=>({newRequests:requests,bytes,cacheHits:hits,attempts,perRace,limits:cap,remoteWrites:false,tlsBypass:false})};
}
