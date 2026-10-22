import {readFile,writeFile,mkdir,readdir,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sha256,productSchema} from './catalog-core.mjs';
import {catalogIdentityProblems} from './catalog-identity.mjs';
export const catalogPublicationAllowlist=['data/verified-products.json','data/verified-products.manifest.json'];
export function assertPagesSource(config){
 if(config?.build_type!=='legacy'||config?.source?.branch!=='gh-pages'||config?.source?.path!=='/')throw new Error('Pages must remain legacy / gh-pages / root; publication refused');
}
export function verifyCatalogPair(text,manifest,now=Date.now(),requireFresh=true){
 const data=JSON.parse(text),ids=new Set();
 if(manifest.schemaVersion!==1||data.schemaVersion!==1||manifest.revision!==data.revision||manifest.generatedAt!==data.generatedAt||manifest.count!==data.products?.length||manifest.sha256!==sha256(Buffer.from(text))||!data.products?.length)throw new Error('Invalid catalog/manifest pair');
 for(const p of data.products){productSchema.parse(p);if(ids.has(p.id))throw new Error('Duplicate ID');ids.add(p.id);}
 if(catalogIdentityProblems(data.products).length)throw new Error('Invalid product identity');
 const at=Date.parse(data.generatedAt),freshProducts=data.products.filter(p=>{const age=now-Date.parse(p.checkedAt);return age>=0&&age<=86400000;}).length;
 if(!Number.isFinite(at)||at>now)throw new Error('Invalid catalog snapshot timestamp');
 if(requireFresh&&(!Number.isFinite(at)||at>now||now-at>30*3600000||!freshProducts))throw new Error('No fresh verified observations; publication refused');
 return {count:data.products.length,freshProducts,retainedHistorical:data.products.length-freshProducts,revision:data.revision};
}
export async function treeHashes(root,prefix=''){
 const result={};for(const entry of await readdir(join(root,prefix),{withFileTypes:true})){
  if(entry.name==='.git')continue;
  const key=prefix?prefix+'/'+entry.name:entry.name,path=join(root,key),s=await lstat(path);
  if(s.isSymbolicLink())throw new Error('Symlink not allowed in publication tree');
  if(s.isDirectory())Object.assign(result,await treeHashes(root,key));else if(s.isFile())result[key]=sha256(await readFile(path));
 }return result;
}
export function assertCatalogOnlyDelta(before,after){
 const changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>before[k]!==after[k]);
 if(changed.some(k=>!catalogPublicationAllowlist.includes(k)))throw new Error('Non-catalog publication mutation refused');return changed;
}
export async function overlayCatalog(siteDir,dataDir,now=Date.now()){
 const text=await readFile(join(dataDir,'verified-products.json'),'utf8'),manifestText=await readFile(join(dataDir,'verified-products.manifest.json'),'utf8');
 const report=verifyCatalogPair(text,JSON.parse(manifestText),now),before=await treeHashes(siteDir);
 const present=catalogPublicationAllowlist.map(path=>Object.hasOwn(before,path));
 if(present.some(Boolean)&&!present.every(Boolean))throw new Error('Existing catalog baseline is incomplete; publication refused');
 if(present.every(Boolean)){
  const previousText=await readFile(join(siteDir,catalogPublicationAllowlist[0]),'utf8'),previousManifest=JSON.parse(await readFile(join(siteDir,catalogPublicationAllowlist[1]),'utf8'));
  const previous=verifyCatalogPair(previousText,previousManifest,now,false);
  if(Date.parse(JSON.parse(text).generatedAt)<Date.parse(previousManifest.generatedAt))throw new Error('Catalog generatedAt downgrade refused');
  if(report.count<Math.ceil(previous.count*.6))throw new Error('Catalog count drop greater than 40% refused');
 }
 await mkdir(join(siteDir,'data'),{recursive:true});await writeFile(join(siteDir,catalogPublicationAllowlist[0]),text);await writeFile(join(siteDir,catalogPublicationAllowlist[1]),manifestText);
 const changed=assertCatalogOnlyDelta(before,await treeHashes(siteDir));return {...report,changed,nonCatalogFilesUnchanged:true};
}
export async function verifyPublicPair(base,dataDir,fetcher=fetch){
 const expected=JSON.parse(await readFile(join(dataDir,'verified-products.manifest.json'),'utf8'));
 const [payload,manifest]=await Promise.all(catalogPublicationAllowlist.map(async path=>{const r=await fetcher(new URL(path,base),{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('Public catalog unavailable');return r.text();}));
 const parsed=JSON.parse(manifest);verifyCatalogPair(payload,parsed);if(parsed.sha256!==expected.sha256||parsed.revision!==expected.revision)throw new Error('Public catalog is not the candidate revision');return {revision:parsed.revision,sha256:parsed.sha256};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const arg=name=>{const at=process.argv.indexOf(name);return at<0?undefined:process.argv[at+1];};
 const dataDir=resolve(arg('--data-dir')||'data');
 if(process.argv.includes('--assert-pages')){let text='';for await(const chunk of process.stdin)text+=chunk;assertPagesSource(JSON.parse(text));console.log('Pages source verified: legacy / gh-pages / root');}
 else if(process.argv.includes('--verify-public'))console.log(JSON.stringify(await verifyPublicPair('https://robom-labs.github.io/runningbom/',dataDir)));
 else{const site=arg('--site-dir');if(!site)throw new Error('--site-dir is required');console.log(JSON.stringify(await overlayCatalog(resolve(site),dataDir)));}
}
