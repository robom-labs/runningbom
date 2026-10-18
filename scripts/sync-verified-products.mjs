import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {productSchema,sha256,fingerprint} from './catalog-core.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const check=process.argv.includes('--check');
const text=await readFile(join(root,'data/verified-products.json'),'utf8');const data=JSON.parse(text);
if(!Array.isArray(data.products)||data.products.length<1)throw new Error('A public catalog must contain actual verified products.');
const seen=new Set();for(const p of data.products){productSchema.parse(p);const k=fingerprint(p);if(seen.has(k))throw new Error('Duplicate model '+k);seen.add(k);}
const manifest={schemaVersion:1,revision:data.revision,generatedAt:data.generatedAt,sha256:sha256(Buffer.from(text)),count:data.products.length};
for(const target of ['data','outputs/pushrun-site/data','apps/mobile/data/catalog']){
 const dir=join(root,target);const manifestText=JSON.stringify(manifest,null,2)+'\n';
 if(check){
  if(target!=='data'&&await readFile(join(dir,'verified-products.json'),'utf8')!==text)throw new Error('Stale product snapshot: '+target);
  if(await readFile(join(dir,'verified-products.manifest.json'),'utf8')!==manifestText)throw new Error('Stale product manifest: '+target);
 }else{
  await mkdir(dir,{recursive:true});
  if(target!=='data')await writeFile(join(dir,'verified-products.json'),text);
  await writeFile(join(dir,'verified-products.manifest.json'),manifestText);
 }
}
console.log(`Verified model catalog synchronized: ${data.products.length}`);
