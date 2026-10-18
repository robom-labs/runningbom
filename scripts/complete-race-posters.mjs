// A directory's matching event poster is an explicit, lower-priority fallback.
// It is never relabeled as a directly verified organizer-page photograph.
import{CheerioCrawler,Configuration}from'@crawlee/cheerio';import{imageSize}from'image-size';
import{readFile,writeFile,mkdir,rename}from'node:fs/promises';import{dirname,join}from'node:path';import{fileURLToPath}from'node:url';
import{publicHttps,publicSourceUrl,imageDigest}from'./race-image-core.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');const file=join(root,'data/race-images.json');
const data=JSON.parse(await readFile(file,'utf8')),races=JSON.parse(await readFile(join(root,'apps/mobile/src/data/races.json'),'utf8')).races;
const extra=JSON.parse(await readFile(join(root,'data/race-poster-source-overrides.json'),'utf8'));
const official=JSON.parse(await readFile(join(root,'data/race-official-sources.json'),'utf8')).entries;
const rejected=JSON.parse(await readFile(join(root,'data/race-image-rejections.json'),'utf8')).entries;
const norm=s=>s.normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
const today=new Date().toISOString().slice(0,10),verified=[],failures=[];const dir=join(root,'outputs/pushrun-site/assets/races');await mkdir(dir,{recursive:true});
const targets=races.filter(r=>!data.images[r.id]||['event-poster-republished','event-logo','organizer-logo'].includes(data.images[r.id].kind));
const crawler=new CheerioCrawler({maxConcurrency:3,maxRequestsPerMinute:60,maxRequestRetries:0,maxSessionRotations:0,navigationTimeoutSecs:12,respectRobotsTxtFile:true,useSessionPool:false,
 async requestHandler({request,$}){
  const race=races.find(r=>r.id===request.userData.id);if(!race)return;
  const heading=$('h1').first().text();if(norm(heading)!==norm(race.name)||!$('body').text().includes(race.raceDate))throw new Error('Poster page name/date differs from this event');
  const url=$('img').map((_,e)=>$(e).attr('src')).get().find(x=>x?.includes('/assets/image/race/domestic/'));
  const image=publicHttps(url,request.url);if(!image)throw new Error('No observed event poster');
  const res=await fetch(image,{signal:AbortSignal.timeout(10000)});if(!res.ok||!/^image\/(jpeg|png|webp|avif)/.test(res.headers.get('content-type')||''))throw new Error('Poster unavailable');
  const bytes=Buffer.from(await res.arrayBuffer());if(bytes.length<2000||bytes.length>12000000)throw new Error('Poster size invalid');const dimensions=imageSize(bytes);if(!dimensions.width||!dimensions.height||dimensions.width<220||dimensions.height<100)throw new Error('Poster resolution invalid');
  const sha=imageDigest(bytes),ext=/png/.test(res.headers.get('content-type')||'')?'png':/webp/.test(res.headers.get('content-type')||'')?'webp':'jpg',cacheFile=race.id+'-'+sha.slice(0,12)+'.'+ext;
  if(rejected[race.id]?.hashes?.includes(sha))throw new Error('Visual review rejected this website capture or unrelated media');
  // Directory thumbnails may be full-site screenshots. Only an already reviewed
  // poster can be refreshed here; unknown covers never masquerade as official media.
  if(data.images[race.id]?.sha256!==sha)throw new Error('Directory image has no reviewed poster evidence; official-source discovery continues independently');
  await writeFile(join(dir,cacheFile),bytes);
  data.images[race.id]={url:image,originalImageUrl:image,source:'마라톤GO · 대회 포스터',sourceUrl:request.url,officialSourceUrl:official[race.id]?.urls[0]||race.officialUrl,checkedAt:today,edition:race.raceDate.slice(0,4),kind:'event-poster-republished',sha256:sha,cacheFile,width:dimensions.width,height:dimensions.height,raceTitle:heading,raceDate:race.raceDate};
  verified.push(race.id);console.log('Verified matching poster: '+race.name);
 },failedRequestHandler:async({request},e)=>failures.push({id:request.userData.id,url:request.url,reason:e.message.slice(0,150)})
},new Configuration({persistStorage:false}));
const requests=targets.map(r=>({url:extra[r.id]||r.sourceDetailUrl,userData:{id:r.id},uniqueKey:r.id})).filter(r=>r.url?.startsWith('https://marathongo.co.kr/raceDetail/domestic/'));
await crawler.run(requests);
// A real event/organizer logo is the final fallback, never a random stock photo.
const logoTargets=races.filter(r=>!data.images[r.id]);
if(logoTargets.length){const logos=new CheerioCrawler({maxConcurrency:2,maxRequestsPerMinute:30,maxRequestRetries:0,maxSessionRotations:0,navigationTimeoutSecs:12,respectRobotsTxtFile:true,useSessionPool:false,
 async requestHandler({request,$}){
  const race=logoTargets.find(r=>r.id===request.userData.id);if(!race)return;
  const candidates=$('img').toArray().filter(e=>/logo|로고|상징/i.test([$(e).attr('alt'),$(e).attr('class'),$(e).attr('src'),$(e).parent().attr('class')].join(' '))).map(e=>publicSourceUrl($(e).attr('src')||$(e).attr('data-src'),request.url)).filter(Boolean);
  for(const url of [...new Set(candidates)]){try{
   if(/vite|react-logo|next-logo/i.test(url))continue;const r=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!r.ok||!/^image\/(jpeg|png|webp)/.test(r.headers.get('content-type')||''))continue;
   const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length<500||bytes.length>3000000)continue;const size=imageSize(bytes);if(!size.width||size.width<48||!size.height||size.height<24)continue;
   const hash=imageDigest(bytes),ext=/png/.test(r.headers.get('content-type')||'')?'png':/webp/.test(r.headers.get('content-type')||'')?'webp':'jpg',cacheFile=race.id+'-'+hash.slice(0,12)+'.'+ext;await writeFile(join(dir,cacheFile),bytes);
   data.images[race.id]={url:url.startsWith('https:')?url:'https://robom-labs.github.io/runningbom/assets/races/'+cacheFile,originalImageUrl:url,source:new URL(request.url).hostname,sourceUrl:request.url,checkedAt:today,edition:race.raceDate.slice(0,4),kind:'organizer-logo',sha256:hash,cacheFile,width:size.width,height:size.height};return;
  }catch{/* Try the next actually published logo. */}}
 },failedRequestHandler:async({request},e)=>failures.push({id:request.userData.id,reason:e.message.slice(0,100)})
 },new Configuration({persistStorage:false}));
 await logos.run(logoTargets.map(r=>({url:official[r.id]?.urls[0]||r.officialUrl,userData:{id:r.id},uniqueKey:r.id})).filter(r=>publicSourceUrl(r.url)));
}
data.revision++;data.checkedAt=today;const text=JSON.stringify(data,null,2)+'\n';await writeFile(file+'.tmp',text);await rename(file+'.tmp',file);
await writeFile(join(root,'outputs/pushrun-site/data/race-images.json'),text);await writeFile(join(root,'apps/mobile/src/data/official-images.json'),text);
const missing=races.filter(r=>!data.images[r.id]).map(r=>({id:r.id,name:r.name}));
await writeFile(join(root,'outputs/operations/race-poster-completion.json'),JSON.stringify({checkedAt:new Date().toISOString(),verified:verified.length,available:Object.keys(data.images).length,missing,failures},null,2)+'\n');
console.log(JSON.stringify({available:Object.keys(data.images).length,missing:missing.length,failures:failures.length}));
// Missing media is explicit in operations and omitted from public UI. It must not
// prevent independent valid caches from being published.
if(!Object.keys(data.images).length)process.exitCode=1;
