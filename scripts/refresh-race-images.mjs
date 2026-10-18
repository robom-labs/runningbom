import { CheerioCrawler, Configuration } from '@crawlee/cheerio';
import { readFile,writeFile,mkdir,rename } from 'node:fs/promises';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {imageSize} from 'image-size';
import { publicHttps,publicSourceUrl,siteMark,representativeImages,isOrganizerPage,imageDigest } from './race-image-core.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const write=process.argv.includes('--write');
const races=JSON.parse(await readFile(join(root,'apps/mobile/src/data/races.json'),'utf8')).races;
const path=join(root,'data/race-images.json');
let previous={revision:0,images:{}};try{previous=JSON.parse(await readFile(path,'utf8'));}catch{/* first verified snapshot */}
// Historical OG URLs did not verify bytes or event identity. They are not promoted automatically.
const images=Object.fromEntries(Object.entries(previous.images||{}).filter(([id,v])=>v.sha256&&v.sourceUrl&&(isOrganizerPage(v.sourceUrl)||v.kind==='event-poster-republished'&&v.sourceUrl.startsWith('https://marathongo.co.kr/raceDetail/domestic/')&&v.raceDate?.slice(0,4)===v.edition)&&(!siteMark(v.url)||['event-logo','organizer-logo'].includes(v.kind))&&races.some(r=>r.id===id&&r.raceDate.slice(0,4)===v.edition)));
let rejected={entries:{}};try{rejected=JSON.parse(await readFile(join(root,'data/race-image-rejections.json'),'utf8'));}catch{}
for(const[id,p]of Object.entries(images))if(rejected.entries[id]?.hashes?.includes(p.sha256))delete images[id];
const today=new Date().toISOString().slice(0,10), failures=[], checked=[];
let discovered={entries:{}};try{discovered=JSON.parse(await readFile(join(root,'data/race-official-sources.json'),'utf8'));}catch{}
const targets=races.filter(r=>r.raceDate>=today);
const visits=new Map();
const requests=targets.flatMap(r=>{
 if(images[r.id]?.checkedAt===today&&images[r.id].kind!=='event-poster-republished')return [];
 const urls=[...(discovered.entries[r.id]?.urls||[]),r.officialUrl].map(u=>publicSourceUrl(u)).filter(u=>u&&isOrganizerPage(u));
 return [...new Set(urls)].slice(0,2).map(url=>({url,uniqueKey:r.id+'|'+url,userData:{raceId:r.id,originalUrl:url}}));
});
const imageDir=join(root,'outputs/pushrun-site/assets/races');await mkdir(imageDir,{recursive:true});
const crawler=new CheerioCrawler({
 maxConcurrency:3,maxRequestsPerMinute:60,maxRequestsPerCrawl:500,maxRequestRetries:0,maxSessionRotations:0,
 navigationTimeoutSecs:15,requestHandlerTimeoutSecs:55,respectRobotsTxtFile:true,useSessionPool:false,retryOnBlocked:false,
 preNavigationHooks:[async(_ctx,opts)=>{opts.headers={'user-agent':'RunningBomEvents/0.3 (+https://robom.kr)',accept:'text/html,application/xhtml+xml'};}],
 async requestHandler({request,$,enqueueLinks}){
  const race=targets.find(r=>r.id===request.userData.raceId);const page=request.loadedUrl||request.url;
  if(!race||!isOrganizerPage(page)||!publicSourceUrl(page))throw new Error('organizer page not verified');
  if(checked.some(x=>x.id===race.id))return;
  const candidates=representativeImages($.html(),page,race);
  // A linked event stylesheet may own the actual visual; read it without executing code.
  const styles=$('link[rel="stylesheet"]').toArray().map(e=>publicSourceUrl($(e).attr('href'),page)).filter(u=>u&&new URL(u).hostname===new URL(page).hostname&&/main|ui\.css|style|index|site/i.test(u));
  for(const url of styles.slice(0,3)){try{const res=await fetch(url,{signal:AbortSignal.timeout(5000)});if(res.ok){const css=await res.text();if(css.length<1_000_000)candidates.push(...representativeImages('<style>'+css+'</style>',url,race));}}catch{/* Existing primary evidence is retained. */}}
  candidates.sort((a,b)=>Number(/logo/.test(a.kind))-Number(/logo/.test(b.kind)));
  for(const c of candidates){try{
   let res;let actualImage=c.url;
   for(let protocolAttempt=0;protocolAttempt<2;protocolAttempt++){
    let next=protocolAttempt?c.url.replace(/^https:/,'http:'):c.url;
    try{for(let hop=0;hop<4;hop++){
      if(!publicSourceUrl(next))throw new Error('private image destination');
      res=await fetch(next,{signal:AbortSignal.timeout(8000),redirect:'manual',headers:{'user-agent':'RunningBomEvents/0.4 (+https://robom.kr)',referer:page,accept:'image/avif,image/webp,image/png,image/jpeg'}});
      if(res.status>=300&&res.status<400){next=publicSourceUrl(res.headers.get('location'),next);continue;}
      actualImage=next;break;
    }if(res?.ok)break;}catch{res=null;}
   }
   if(!res)continue;
   if(!res.ok||!/^image\/(jpeg|png|webp|avif|gif)/.test(res.headers.get('content-type')||''))continue;
   if(Number(res.headers.get('content-length')||0)>12_000_000)continue;
   const bytes=Buffer.from(await res.arrayBuffer());if(bytes.length<2000||bytes.length>12_000_000)continue;
   const logo=/logo/.test(c.kind);const dimensions=imageSize(bytes);if(!dimensions.width||!dimensions.height||dimensions.width<(logo?48:220)||dimensions.height<(logo?24:100)||!logo&&dimensions.width*dimensions.height<70000)continue;
   const hash=imageDigest(bytes);const mime=res.headers.get('content-type')||'';const ext=/png/.test(mime)?'png':/webp/.test(mime)?'webp':/avif/.test(mime)?'avif':/gif/.test(mime)?'gif':'jpg';const cacheName=race.id+'-'+hash.slice(0,12)+'.'+ext;
   if(rejected.entries[race.id]?.hashes?.includes(hash))continue;
   await writeFile(join(imageDir,cacheName),bytes);
   images[race.id]={url:actualImage.startsWith('https:')?actualImage:'https://robom-labs.github.io/runningbom/assets/races/'+cacheName,originalImageUrl:actualImage,source:new URL(page).hostname,sourceUrl:page,discoveredVia:discovered.entries[race.id]?.discoveredVia||page,checkedAt:today,edition:race.raceDate.slice(0,4),kind:c.kind,sha256:hash,cacheFile:cacheName,width:dimensions.width,height:dimensions.height};
   checked.push({id:race.id,result:'verified',sourceUrl:page});console.log('Verified event image: '+race.name+' ('+checked.length+')');return;
  }catch{/* another explicitly declared representative may still work */}}
  // Home, observed frames and an explicitly named info page often own the poster.
  const visited=visits.get(race.id)||new Set();visited.add(page);visits.set(race.id,visited);
  if(visited.size<4){
   const links=[];$('frame[src],iframe[src],a[href]').each((_,el)=>{
    const e=$(el),raw=e.attr('src')||e.attr('href'),u=publicSourceUrl(raw,page);if(!u||new URL(u).hostname!==new URL(page).hostname||visited.has(u))return;
    if(el.tagName==='frame'||el.tagName==='iframe'||new URL(u).pathname==='/'||/^(홈|home|메인|대회안내|대회소개|대회개요|대회요강)$/i.test(e.text().trim()))links.push(u);
   });
   if(links.length)await enqueueLinks({urls:[...new Set(links)].slice(0,3),userData:{raceId:race.id},transformRequestFunction:r=>({...r,uniqueKey:race.id+'|'+r.url})});
  }
  failures.push({id:race.id,url:page,reason:'No verifiable representative image for this edition'});
 },
 failedRequestHandler:async({request},error)=>{
  const original=request.userData.originalUrl;
  // A primary source can still be HTTP-only; only fetch public pages, never credentials.
  if(original?.startsWith('http:')&&request.url.startsWith('https:'))await crawler.addRequests([{url:original,uniqueKey:request.userData.raceId+'|http-fallback',userData:{raceId:request.userData.raceId}}]);
  failures.push({id:request.userData.raceId,url:request.url,reason:error.message.slice(0,140)});
 },
},new Configuration({persistStorage:false}));
await crawler.run(requests);
// A shared organizer logo is not the featured poster for several different events.
const uses=new Map();for(const v of Object.values(images))uses.set(v.sha256,(uses.get(v.sha256)||0)+1);
for(const [id,v] of Object.entries(images))if(uses.get(v.sha256)>2&&!['event-logo','organizer-logo'].includes(v.kind)){delete images[id];failures.push({id,reason:'Shared image rejected'});}
const report={checkedAt:new Date().toISOString(),targets:targets.length,verified:checked.length,available:Object.keys(images).length,missing:races.filter(r=>r.raceDate>=today&&!images[r.id]).map(r=>({id:r.id,name:r.name,reason:isOrganizerPage(r.officialUrl)?'image verification pending':'organizer URL not confirmed'})),failures};
await mkdir(join(root,'outputs/operations'),{recursive:true});await writeFile(join(root,'outputs/operations/race-images.json'),JSON.stringify(report,null,2)+'\n');
if(requests.length && !checked.length)throw new Error('No official race images verified; previous snapshot retained.');
if(write){
 const payload={schemaVersion:1,revision:(previous.revision||0)+1,checkedAt:today,images};const text=JSON.stringify(payload,null,2)+'\n';
 await writeFile(path+'.tmp',text);await rename(path+'.tmp',path);
 await mkdir(join(root,'outputs/pushrun-site/data'),{recursive:true});
 await writeFile(join(root,'outputs/pushrun-site/data/race-images.json'),text);
 await writeFile(join(root,'apps/mobile/src/data/official-images.json'),text);
}
console.log(JSON.stringify({write,targets:targets.length,verified:checked.length,available:Object.keys(images).length,missing:report.missing.length}));
