// Reviewed metadata-only operation: no network/crawl and no observation timestamp refresh.
import {readFile,writeFile} from 'node:fs/promises';
import {repairCatalogMetadata} from './catalog-family-metadata.mjs';
import {verifyCatalogPair} from './catalog-only-publication.mjs';
import {sha256} from './catalog-core.mjs';
const file=new URL('../data/verified-products.json',import.meta.url),manifestFile=new URL('../data/verified-products.manifest.json',import.meta.url);
const text=await readFile(file,'utf8'),manifest=JSON.parse(await readFile(manifestFile,'utf8'));
verifyCatalogPair(text,manifest,Date.now(),false);
const result=repairCatalogMetadata(JSON.parse(text)),next=JSON.stringify(result.snapshot,null,2)+'\n';
const nextManifest={...manifest,revision:result.snapshot.revision,sha256:sha256(Buffer.from(next))};
verifyCatalogPair(next,nextManifest,Date.now(),false);
if(process.argv.includes('--write')){
 await writeFile(file,next);await writeFile(manifestFile,JSON.stringify(nextManifest,null,2)+'\n');
}
console.log(JSON.stringify({mode:'reviewed-metadata-only',networkRequests:0,sourceCoverage:'not-rechecked; prior partial failures remain',generatedAtUnchanged:result.snapshot.generatedAt===manifest.generatedAt,count:nextManifest.count,revision:nextManifest.revision,sha256:nextManifest.sha256,affected:result.mappings.length,mappings:result.mappings},null,2));
