// Verify original photo bytes and the portable project snapshot after transfer.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=async path=>JSON.parse(await readFile(join(root,path),'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const failures=[];
async function verified(path,expected){try{const bytes=await readFile(path);if(digest(bytes)!==expected)throw new Error('SHA-256 mismatch');return bytes.length;}catch(e){failures.push({path:relative(root,path).replaceAll('\\','/'),reason:e.message});return 0;}}
const catalog=await read('data/verified-products.json'),manifest=await read('data/verified-products.manifest.json');
await verified(join(root,'data/verified-products.json'),manifest.sha256);
const web=await read('apps/review/src/features/products.json');
if(manifest.count!==catalog.products.length||web.length!==catalog.products.length||web.some(p=>!catalog.products.some(c=>c.id===p.id&&c.imageSha256===p.imageSha256)))failures.push({path:'apps/review/src/features/products.json',reason:'catalog snapshots differ'});
let webPhotos=0,nativePhotos=0,racePhotos=0,raceBytes=0;
for(const p of web){if(!p.image?.startsWith('/assets/products/'))continue;const bytes=await verified(join(root,'apps/review/public',p.image),p.imageSha256);if(bytes)webPhotos++;}
const nativeFile=join(root,'apps/mobile/domains/catalog/catalogImages.ts');
const native=await readFile(nativeFile,'utf8');
for(const match of native.matchAll(/"([^"]+)":\s*\{source:require\('([^']+)'\),sha256:"([a-f0-9]{64})"\}/g)){
 const [,id,path,hash]=match;const bytes=await verified(resolve(dirname(nativeFile),path),hash);
 if(bytes&&catalog.products.find(p=>p.id===id)?.imageSha256===hash)nativePhotos++;
}
const media=await read('data/race-images.json');
for(const [id,p] of Object.entries(media.images)){
 if(!p.width||!p.height||!p.cacheFile||!/^[-\w.]+$/.test(p.cacheFile)){failures.push({id,reason:'missing original dimensions/cache'});continue;}
 const bytes=await verified(join(root,'outputs/pushrun-site/assets/races',p.cacheFile),p.sha256);
 await verified(join(root,'apps/review/public/assets/races',p.cacheFile),p.sha256);
 if(bytes){racePhotos++;raceBytes+=bytes;}
}
const raw=await read('apps/mobile/src/data/races.json');
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
const publicRows=raw.races.filter(r=>r.raceDate>=today&&r.registrationDataStatus!=='needs-review'&&!r.needsReview&&(!r.name.match(/20\d{2}/)?.[0]||r.name.match(/20\d{2}/)[0]===r.raceDate.slice(0,4))).filter(r=>r.id!=='schedule-dd6c6bcc11f2'||!raw.races.some(p=>p.id==='schedule-0e4e73276928'&&p.raceDate===r.raceDate));
let runtime='passed';try{execFileSync(process.execPath,['scripts/check-mobile-runtime.mjs'],{cwd:join(root,'apps/review'),stdio:'pipe'});}catch{runtime='failed';failures.push({path:'apps/review/mobile-runtime.lock.json',reason:'protected runtime changed'});}
const result={schemaVersion:1,checkedAt:new Date().toISOString(),catalogRevision:catalog.revision,models:catalog.products.length,brands:new Set(catalog.products.map(p=>p.brand)).size,upcoming:catalog.products.filter(p=>p.upcoming).length,webExactPhotos:webPhotos,nativeExactPhotos:nativePhotos,rawRaces:raw.races.length,publicRaces:publicRows.length,publicRaceDate:today,verifiedRacePhotos:racePhotos,racePhotoMiB:Number((raceBytes/1024/1024).toFixed(2)),runtime,failures};
if(process.argv.includes('--write')){await mkdir(join(root,'outputs/release-review/evidence'),{recursive:true});await writeFile(join(root,'outputs/release-review/evidence/handoff-integrity.json'),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result,null,2));if(failures.length)process.exitCode=1;
