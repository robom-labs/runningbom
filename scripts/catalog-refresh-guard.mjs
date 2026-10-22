export function assessCatalogCandidate(previous,next,now=Date.now()){
 const errors=[],products=Array.isArray(next?.products)?next.products:[];
 const previousCount=Array.isArray(previous?.products)?previous.products.length:0;
 if(next?.schemaVersion!==1||!products.length)errors.push('invalid-schema');
 if(products.length<Math.ceil(previousCount*.6))errors.push('drastic-count-drop');
 const seen=new Set();
 for(const row of products){
  if(!row?.id||seen.has(row.id))errors.push('duplicate-or-missing-id');seen.add(row?.id);
  const checked=Date.parse(row?.checkedAt);
  if(!Number.isFinite(checked)||checked>now+300000)errors.push('invalid-observation-date');
  for(const key of ['source','imageSource']){try{const url=new URL(row?.[key]);if(url.protocol!=='https:'||url.username||url.password)errors.push('invalid-source-provenance');}catch{errors.push('invalid-source-provenance');}}
 }
 const generated=Date.parse(next?.generatedAt);
 if(!Number.isFinite(generated)||generated>now+300000||generated<Date.parse(previous?.generatedAt))errors.push('invalid-snapshot-date');
 return {ok:errors.length===0,errors:[...new Set(errors)],metrics:{previousCount,count:products.length,retainedRatio:previousCount?products.length/previousCount:null}};
}
