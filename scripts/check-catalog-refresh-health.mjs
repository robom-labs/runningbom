import {readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';
export function pipelineHealth(collection,enrichment){
 const collectionComplete=collection?.publicationDecision==='validated'&&collection.noVerifiedSources?.length===0&&collection.failures?.length===0;
 const enrichmentComplete=enrichment?.allSourcesSucceeded===true;
 return {complete:collectionComplete&&enrichmentComplete,collection:collectionComplete?'complete':'partial-failed',enrichment:enrichmentComplete?'complete':'partial-failed',safeCandidateValidated:collection?.publicationDecision==='validated',sourcesWithoutUpdates:collection?.noVerifiedSources||[],collectionFailures:collection?.failures?.length??null,enrichmentFailures:enrichment?.failures?.length??null,featureMissing:enrichment?.features?.missing?.length??null,featureStaleLKG:enrichment?.features?.staleRetained??null,photosSourceApproved:enrichment?.photos?.sourceApproved??null,records:enrichment?.records??null};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const read=async p=>{try{return JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));}catch{return null;}};
 const health=pipelineHealth(await read('outputs/operations/catalog-refresh.json'),await read('outputs/operations/catalog-enriched/enrichment-report.json'));console.log(JSON.stringify(health));if(!health.complete)process.exitCode=1;
}
