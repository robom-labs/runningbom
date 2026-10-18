// Keep the exact previously verified bytes; no resizing/recoloring or stock replacement.
import{readFile,writeFile,mkdir}from'node:fs/promises';import{dirname,join}from'node:path';import{fileURLToPath}from'node:url';
import{imageDigest,publicHttps}from'./race-image-core.mjs';import{imageSize}from'image-size';
const root=join(dirname(fileURLToPath(import.meta.url)),'..'),file=join(root,'data/race-images.json');const data=JSON.parse(await readFile(file,'utf8'));
const dir=join(root,'outputs/pushrun-site/assets/races');await mkdir(dir,{recursive:true});const failures=[];let cursor=0;const rows=Object.entries(data.images);
async function work(){while(cursor<rows.length){const[id,p]=rows[cursor++];try{
 if(p.cacheFile){const bytes=await readFile(join(dir,p.cacheFile));if(imageDigest(bytes)===p.sha256){const d=imageSize(bytes);p.width=d.width;p.height=d.height;continue;}}
 if(!publicHttps(p.url))throw new Error('public source');const r=await fetch(p.url,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('HTTP '+r.status);
 const bytes=Buffer.from(await r.arrayBuffer());if(imageDigest(bytes)!==p.sha256)throw new Error('source bytes changed; reverify first');const d=imageSize(bytes);
 const ext=/png/.test(r.headers.get('content-type')||'')?'png':/webp/.test(r.headers.get('content-type')||'')?'webp':/avif/.test(r.headers.get('content-type')||'')?'avif':'jpg';
 p.cacheFile=id+'-'+p.sha256.slice(0,12)+'.'+ext;p.width=d.width;p.height=d.height;await writeFile(join(dir,p.cacheFile),bytes);
 }catch(e){failures.push({id,reason:e.message});}}}
await Promise.all(Array.from({length:4},work));const text=JSON.stringify(data,null,2)+'\n';for(const f of [file,join(root,'outputs/pushrun-site/data/race-images.json'),join(root,'apps/mobile/src/data/official-images.json')])await writeFile(f,text);
await writeFile(join(root,'outputs/operations/race-image-cache.json'),JSON.stringify({checkedAt:new Date().toISOString(),total:rows.length,cached:rows.filter(([,p])=>p.cacheFile).length,failures},null,2)+'\n');console.log(JSON.stringify({total:rows.length,cached:rows.filter(([,p])=>p.cacheFile).length,failures}));
if(failures.length)process.exitCode=1;
