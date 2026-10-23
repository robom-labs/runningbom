// Bounded, metadata-only correction. No arbitrary URLs, app files, prices or
// observation timestamps are rewritten. A failed parent read preserves LKG.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {load} from 'cheerio';
import {officialBrooksGroups,officialGroupMetadata,isOfficialBrooksSizeVariant} from './catalog-official-groups.mjs';
import {productSchema,sha256} from './catalog-core.mjs';
import {verifyCatalogPair} from './catalog-only-publication.mjs';

const file=new URL('../data/verified-products.json',import.meta.url);
const beforeText=await readFile(file,'utf8'),before=JSON.parse(beforeText),checkedAt=new Date().toISOString(),groups=[];
const sources=[
 'https://www.brooksrunning.com.au/ghost-amp-womens-neutral-running-shoe/120486.html?colour=612&width=1B',
 'https://www.brooksrunning.com.au/ghost-18-mens-neutral-running-shoe/110493.html?colour=429&width=1D',
];
for(const url of sources){
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'Runningbom-public-catalog-maintenance/1.0'}});
 if(!response.ok)throw new Error('Official ProductGroup unavailable: '+response.status);
 const chunks=[];let bytes=0;
 for await(const chunk of response.body){bytes+=chunk.length;if(bytes>12_000_000)throw new Error('Official page size limit');chunks.push(chunk);}
 const parsed=officialBrooksGroups(load(Buffer.concat(chunks).toString('utf8')),url,checkedAt);
 if(parsed.length!==1)throw new Error('Expected exactly one official parent group');
 groups.push(...parsed);
}
let changed=0;
const products=before.products.map(p=>{
 const metadata=officialGroupMetadata(p,groups);
 if(!metadata){if(isOfficialBrooksSizeVariant(p))throw new Error('Unbound size variant: '+p.id);return p;}
 changed++;return {...p,...metadata,sourceTitle:p.sourceTitle||p.name};
});
if(!changed||products.length!==before.products.length)throw new Error('Empty or count-changing repair refused');
for(const p of products)productSchema.parse(p);
const next={...before,generatedAt:checkedAt,revision:'catalog-'+sha256(Buffer.from(JSON.stringify(products))).slice(0,16),products};
const text=JSON.stringify(next,null,2)+'\n';
const manifest={schemaVersion:1,revision:next.revision,generatedAt:next.generatedAt,sha256:sha256(Buffer.from(text)),count:products.length};
verifyCatalogPair(text,manifest);
const audit=new URL('../outputs/operations/',import.meta.url);await mkdir(audit,{recursive:true});
await writeFile(new URL('catalog-before-grouping.json',audit),beforeText);
await writeFile(new URL('catalog-official-groups-evidence.json',audit),JSON.stringify({checkedAt,sources,groups},null,2)+'\n');
if(process.argv.includes('--write')){
 await writeFile(file,text);
 await writeFile(new URL('../data/verified-products.manifest.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
}
console.log(JSON.stringify({write:process.argv.includes('--write'),variants:products.length,normalized:changed,officialParents:groups.map(g=>({id:g.id,name:g.name,children:g.variants.length,widths:[...new Set(g.variants.map(v=>v.width))]})),revision:next.revision,sha256:manifest.sha256}));
