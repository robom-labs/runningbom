// Revalidate reviewed primary-page logos/banners. Changed bytes go to operations;
// a new image never inherits the approval of an older image at the same URL.
import{readFile,writeFile,mkdir}from'node:fs/promises';import{dirname,join}from'node:path';import{fileURLToPath}from'node:url';
import{imageSize}from'image-size';import{imageDigest,publicSourceUrl}from'./race-image-core.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..'),file=join(root,'data/race-images.json');
const config=JSON.parse(await readFile(join(root,'data/race-media-overrides.json'),'utf8'));
const data=JSON.parse(await readFile(file,'utf8')),races=JSON.parse(await readFile(join(root,'apps/mobile/src/data/races.json'),'utf8')).races;
const failures=[],verified=[];const dir=join(root,'outputs/pushrun-site/assets/races');await mkdir(dir,{recursive:true});
for(const row of config.entries){try{
 if(!publicSourceUrl(row.page)||!publicSourceUrl(row.url))throw new Error('Invalid public source');
 const race=races.find(r=>r.id===row.id);if(!race)continue;
 const page=await fetch(row.page,{signal:AbortSignal.timeout(10000)});if(!page.ok)throw new Error('Source page unavailable');const html=await page.text();
 if(!html.includes(row.url)&&!html.includes(new URL(row.url).pathname))throw new Error('Image is no longer declared by the primary page');
 const response=await fetch(row.url,{signal:AbortSignal.timeout(10000),headers:{referer:row.page}});const mime=response.headers.get('content-type')||'';
 if(!response.ok||!/^image\/(png|jpeg|webp|gif)/.test(mime))throw new Error('Image unavailable');
 const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>12000000||imageDigest(bytes)!==row.sha256)throw new Error('Original image changed; prior approved bytes retained');
 const size=imageSize(bytes),ext=/png/.test(mime)?'png':/webp/.test(mime)?'webp':/gif/.test(mime)?'gif':'jpg';const cacheFile=row.id+'-'+row.sha256.slice(0,12)+'.'+ext;await writeFile(join(dir,cacheFile),bytes);
 data.images[row.id]={url:row.url.startsWith('https:')?row.url:'https://robom-labs.github.io/runningbom/assets/races/'+cacheFile,originalImageUrl:row.url,source:new URL(row.page).hostname,sourceUrl:row.page,kind:row.kind,edition:race.raceDate.slice(0,4),checkedAt:new Date().toISOString().slice(0,10),sha256:row.sha256,cacheFile,width:size.width,height:size.height,verification:'primary-page declaration + visual review'};verified.push(row.id);
 }catch(e){failures.push({id:row.id,reason:e.message});}}
data.revision++;const text=JSON.stringify(data,null,2)+'\n';for(const target of [file,join(root,'apps/mobile/src/data/official-images.json'),join(root,'outputs/pushrun-site/data/race-images.json')])await writeFile(target,text);
await mkdir(join(root,'outputs/operations'),{recursive:true});await writeFile(join(root,'outputs/operations/reviewed-race-media.json'),JSON.stringify({checkedAt:new Date().toISOString(),verified,failures},null,2)+'\n');
console.log(JSON.stringify({verified:verified.length,failures:failures.length,available:Object.keys(data.images).length}));if(failures.length)process.exitCode=1;
