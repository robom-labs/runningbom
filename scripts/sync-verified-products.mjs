import {readFile,writeFile,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {productSchema,sha256,fingerprint} from './catalog-core.mjs';
import {catalogIdentityProblems} from './catalog-identity.mjs';
const file=new URL('../data/verified-products.json',import.meta.url),target=new URL('../data/verified-products.manifest.json',import.meta.url);
const text=await readFile(file,'utf8'),data=JSON.parse(text),seen=new Set();
if(data.schemaVersion!==1||!data.products?.length||!data.revision||!Number.isFinite(Date.parse(data.generatedAt)))throw new Error('Invalid catalog envelope');
for(const p of data.products){productSchema.parse(p);const key=fingerprint(p);if(seen.has(key))throw new Error('Duplicate product model');seen.add(key);}
if(catalogIdentityProblems(data.products).length)throw new Error('Invalid catalog identities');
const manifest={schemaVersion:1,revision:data.revision,generatedAt:data.generatedAt,sha256:sha256(Buffer.from(text)),count:data.products.length};
const expected=JSON.stringify(manifest,null,2)+'\n';
if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==expected)throw new Error('Catalog manifest mismatch');}
else{await writeFile(fileURLToPath(target)+'.tmp',expected);await rename(fileURLToPath(target)+'.tmp',target);}
console.log(`Verified catalog envelope: ${data.products.length}; no app/native/output mirrors written`);
