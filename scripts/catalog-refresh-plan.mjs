import {approvedCatalogUrl} from './catalog-source-policy.mjs';
export function planCatalogSeeds(registry,products,max){
 const queues=registry.map(s=>[
  ...products.filter(p=>p.brand.toLowerCase()===s.brand.toLowerCase()&&p.sourceRegion===s.region&&approvedCatalogUrl(p.source,s)).sort((a,b)=>Date.parse(a.checkedAt)-Date.parse(b.checkedAt)).map((p,i)=>({url:p.source,userData:{sourceId:s.id,discovery:i<1}})),
  ...s.collections.map(url=>({url,userData:{sourceId:s.id,discovery:true}})),
 ]);
 const seeds=[],seen=new Set();
 for(let i=0;queues.some(q=>q[i]);i++)for(const q of queues)if(q[i]&&!seen.has(q[i].url)){seen.add(q[i].url);seeds.push(q[i]);}
 // Give every registered source with a known seed a slot before discovery.
 // A small explicit request cap remains authoritative and visible in health.
 const active=queues.filter(q=>q.length).length;
 return seeds.slice(0,Math.max(Math.min(active,max),Math.floor(max*.6)));
}
export function discoveredCatalogProduct(value,source){
 try{
  const u=new URL(value);if(!approvedCatalogUrl(value,source)||u.hash)return false;
  if(source.id==='asics-1')return /^\/p\/AKR_\d{9}-\d{3}$/.test(u.pathname);
  return new RegExp(source.productPattern).test(u.pathname);
 }catch{return false;}
}
export function sourcePageDiagnosis($,rows){
 const title=$('title').text().replace(/\s+/g,' ').trim(),heading=$('h1').first().text().trim();
 const blocked=/access denied|just a moment|pardon our interruption|request blocked|403 forbidden|verify (?:that )?you are human/i.test(title+' '+heading);
 const structuredTypes=[],products=[];let malformedBlocks=0;
 const walk=value=>{if(Array.isArray(value)){value.forEach(walk);return;}if(!value||typeof value!=='object')return;
  if(value['@type'])structuredTypes.push(value['@type']);
  if([value['@type']].flat().some(t=>t==='Product'||t==='ProductGroup'))products.push({type:value['@type'],name:value.name,brand:value.brand,hasImage:!!value.image,offerType:value.offers?.['@type'],currency:value.offers?.priceCurrency,offersArray:Array.isArray(value.offers)?value.offers.length:undefined});
  for(const k of ['@graph','hasVariant','itemListElement','item'])walk(value[k]);};
 $('script[type="application/ld+json"]').each((_,n)=>{try{walk(JSON.parse($(n).text()));}catch{malformedBlocks++;}});
 return {title,structuredBlocks:$('script[type="application/ld+json"]').length,structuredTypes:[...new Set(structuredTypes.flat())],malformedBlocks,productEvidence:products.slice(0,2),blockPage:blocked,status:blocked?'blocked-document':rows.length?'parsed':'no-supported-product-evidence'};
}
export function catalogRefreshPhases(report,{write=false}={}){
 const missing=report.sourceHealth.filter(s=>!s.verified).map(s=>s.id),safe=report.verified>0&&report.health?.ok===true;
 return {
  collection:{status:missing.length||report.failures.length?'partial-failed':'complete',verifiedSources:report.sourceHealth.length-missing.length,totalSources:report.sourceHealth.length,missingSources:missing,failures:report.failures.length},
  admission:{status:report.quarantined.length?'review-required':'complete',quarantined:report.quarantined.length},
  validation:{status:safe?'passed':'failed'},
  publication:{status:write&&safe?'candidate-written':'not-requested',actualPublicPairVerified:false},
 };
}
