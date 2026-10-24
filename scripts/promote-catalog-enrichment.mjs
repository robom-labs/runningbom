// Main-only persistence: pair + server evidence. Public publisher still overlays
// ONLY its existing two-file catalog allowlist, never this audit sidecar.
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';import {resolve,dirname,join} from 'node:path';import {fileURLToPath} from 'node:url';
import {verifyCatalogPair} from './catalog-only-publication.mjs';import {assertPublicBudget,restoreServerEvidence} from './catalog-public-evidence.mjs';import {validFeatureEvidence} from './catalog-enrichment-core.mjs';
export async function promoteCatalogEnrichment(sourceDir,targetDir){
 const files=['verified-products.json','verified-products.manifest.json','catalog-enrichment-evidence.json'],values=await Promise.all(files.map(f=>readFile(join(sourceDir,f),'utf8'))),[text,manifestText,auditText]=values,manifest=JSON.parse(manifestText),catalog=JSON.parse(text),audit=JSON.parse(auditText);
 verifyCatalogPair(text,manifest);assertPublicBudget(text);const restored=restoreServerEvidence(catalog,audit);
 for(const p of restored.products)if(p.decisionEvidence&&!validFeatureEvidence(p))throw Error('Missing exact server feature proof: '+p.id);
 const previousText=await readFile(join(targetDir,files[0]),'utf8'),previous=JSON.parse(previousText),previousManifest=JSON.parse(await readFile(join(targetDir,files[1]),'utf8'));verifyCatalogPair(previousText,previousManifest,Date.now(),false);
 if(Date.parse(catalog.generatedAt)<Date.parse(previous.generatedAt))throw Error('Older enriched candidate');
 for(const old of previous.products){const p=catalog.products.find(p=>p.id===old.id);if(!p||['sku','currency','sourceRegion','modelGroup'].some(k=>p[k]!==old[k]))throw Error('Last-good identity/family lost: '+old.id);}
 await mkdir(targetDir,{recursive:true});for(let i=0;i<files.length;i++)await writeFile(join(targetDir,files[i]+'.tmp'),values[i]);for(const f of files)await rename(join(targetDir,f+'.tmp'),join(targetDir,f));return {count:catalog.products.length,revision:catalog.revision,files};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2),i=args.indexOf('--candidate-dir');if(i<0||!args[i+1])throw Error('Explicit candidate directory required');
 console.log(JSON.stringify(await promoteCatalogEnrichment(resolve(args[i+1]),join(root,'data'))));
}
