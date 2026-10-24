import {readFile,writeFile,rename} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
import {z} from 'zod';
import {productSchema,sha256} from './catalog-core.mjs';
import {catalogIdentityProblems,catalogRecordKey} from './catalog-identity.mjs';
import {verifyCatalogPair} from './catalog-only-publication.mjs';
// Same manifest field contract as the native feed; JSON property order is not identity.
const manifestSchema=z.object({schemaVersion:z.literal(1),revision:z.string().min(1),generatedAt:z.iso.datetime({offset:true}),count:z.number().int().positive(),sha256:z.string().regex(/^[a-f0-9]{64}$/)});
export function catalogManifestFor(text){
const data=JSON.parse(text),seen=new Set();
if(data.schemaVersion!==1||!data.products?.length||!data.revision||!Number.isFinite(Date.parse(data.generatedAt)))throw new Error('Invalid catalog envelope');
for(const p of data.products){productSchema.parse(p);const key=catalogRecordKey(p);if(seen.has(key))throw new Error('Duplicate product identity');seen.add(key);}
if(catalogIdentityProblems(data.products).length)throw new Error('Invalid catalog identities');
return manifestSchema.parse({schemaVersion:1,revision:data.revision,generatedAt:data.generatedAt,sha256:sha256(Buffer.from(text)),count:data.products.length});
}
export function verifyCatalogManifest(text,manifest,now=Date.now()){
 catalogManifestFor(text);manifestSchema.parse(manifest);
 return verifyCatalogPair(text,manifest,now);
}
export async function syncCatalogManifest(dataDir,{check=false,now=Date.now()}={}){
 const file=join(dataDir,'verified-products.json'),target=join(dataDir,'verified-products.manifest.json'),text=await readFile(file,'utf8');
 if(check)return verifyCatalogManifest(text,JSON.parse(await readFile(target,'utf8')),now);
 const manifest=catalogManifestFor(text),expected=JSON.stringify(manifest,null,2)+'\n';
 await writeFile(target+'.tmp',expected);await rename(target+'.tmp',target);return {count:manifest.count};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const result=await syncCatalogManifest(fileURLToPath(new URL('../data',import.meta.url)),{check:process.argv.includes('--check')});
 console.log(`Verified catalog envelope: ${result.count}; no app/native/output mirrors written`);
}
