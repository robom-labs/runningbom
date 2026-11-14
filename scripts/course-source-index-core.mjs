import{safeCourseURL,courseDigest,disciplineKeys,distanceLabel,courseDisciplineLiteral,currentCourseOption,coursePagePublicationKind}from'./course-discovery-core.mjs';
// A separate page registry: never extends sourceKind or fabricates course geometry.
export function verifyCourseSourceIndex(raw,races,{now=Date.now(),maxAgeDays=30,raceBytes}={}){
 if(raw?.schemaVersion!==1||!Array.isArray(raw.records)||raw.sourceRecordCount!==races.length||raw.records.length!==races.length||!/^[a-f0-9]{64}$/.test(raw.sourceSnapshotSha256||''))throw Error('Page index schema/count/source binding');
 if(raceBytes!==undefined&&(raw.sourceSnapshotSha256!==courseDigest(raceBytes)||JSON.stringify(JSON.parse(raceBytes.toString()).races)!==JSON.stringify(races)))throw Error('Page index exact race-byte binding');
 const seen=new Set(),verified=[];
 for(const row of raw.records){const race=races.find(r=>r.id===row.eventId);if(!race||seen.has(row.eventId)||row.raceDate!==race.raceDate||!Array.isArray(row.resolvedOfficialPages)||!Array.isArray(row.seedUrls))throw Error('Page index race/edition mismatch');seen.add(row.eventId);
  if(raceBytes!==undefined&&(row.eventName!==race.name||JSON.stringify([...disciplineKeys(row.distanceKeys)].sort())!==JSON.stringify([...disciplineKeys(race.distances)].sort())))throw Error('Page index current name/discipline binding');
  if(raceBytes!==undefined&&raw.raceIdentityBindings){const binding=raw.raceIdentityBindings[race.id];if(!binding||binding.name!==race.name||binding.raceDate!==race.raceDate||JSON.stringify(binding.distances)!==JSON.stringify(race.distances.map(courseDisciplineLiteral).sort()))throw Error('Page index literal division identity binding');}
  const urls=new Set();for(const page of row.resolvedOfficialPages){
   if(page.courseContentStatus!==undefined&&(page.courseContentEvidence?.status!==page.courseContentStatus||page.courseContentEvidence.sourceUrl!==page.url||page.courseContentEvidence.sourceSha256!==page.sha256||page.courseContentEvidence.checkedAt!==page.checkedAt))throw Error('Unbound course publication classification');
   if(page.courseContentStatus==='unpublished'&&page.pageKind==='course')throw Error('Unpublished course cannot count as course content');
   if(urls.has(page.url)||!safeCourseURL(page.url)||!['course','event'].includes(page.pageKind)||page.verified!==true||!row.seedUrls.includes(page.seedURL)||!/^[a-f0-9]{64}$/.test(page.sha256||'')||!Number.isFinite(Date.parse(page.checkedAt))||Date.parse(page.checkedAt)>now+300000||now-Date.parse(page.checkedAt)>maxAgeDays*86400000||page.editionEvidence?.accepted!==true||page.editionEvidence?.raceDate!==race.raceDate||page.editionEvidence.year!==race.raceDate.slice(0,4))throw Error('Unverified/expired page in trusted source index');urls.add(page.url);
   if(page.editionEvidence.method==='same-origin-direct-declaration'){const parent=row.resolvedOfficialPages.find(p=>p.url===page.editionEvidence.inheritedFrom);if(!parent||page.declaredBy!==parent.url||new URL(page.url).origin!==new URL(parent.url).origin||!page.editionEvidence.directlyDeclared)throw Error('Page edition inheritance not bound to direct official parent');}
   verified.push({eventId:row.eventId,raceDate:row.raceDate,...page});
  }
 }
 return{records:raw.records.length,verifiedPages:verified.length,coursePages:verified.filter(p=>coursePagePublicationKind(p)==='course').length,sourceIndexSha256:courseDigest(JSON.stringify(raw)),appTypeChanges:false};
}
// SAME catalog payload. No excerpts, seed URL list, unverified rows or guessed distances.
export function courseCatalogPages(index,races,options={}){
 verifyCourseSourceIndex(index,races,options);const pages=[];
 for(const row of index.records)for(const p of row.resolvedOfficialPages){
  let labels=p.distanceLabels;
  // Fresh exact-literal declarations survive the slim public page projection;
  // a generic numeric page label must not silently stand for a named option.
  const race=races.find(r=>r.id===row.eventId);
  if(p.sourceRepresentation==='raw-html'&&p.disciplineDeclarations?.some(d=>d.kind==='named'))labels=[...new Set(p.disciplineDeclarations.map(d=>d.literal).filter(l=>currentCourseOption(race,l)))];
  // Explicit dedicated URL/title bindings cannot silently become a generic fallback.
  const titleKeys=/(?:full|half|하프|풀|\d+(?:\.\d+)?\s*k(?:m)?)\s*(?:코스|course)/i.test(p.title)?disciplineKeys(p.title):[],pathKeys=disciplineKeys(decodeURIComponent(new URL(p.url).pathname).replace(/[_/.-]/g,' '));
  const dedicated=pathKeys.length===1?pathKeys:titleKeys.length===1?titleKeys:[];
  if(!labels?.length&&p.pageKind==='course'&&dedicated.length)labels=dedicated.map(distanceLabel);
  if(labels?.length){if(labels.some(l=>!currentCourseOption(race,l))){options.onQuarantine?.({eventId:row.eventId,url:p.url,reason:'dedicated-page-distance-not-in-current-race',distanceLabels:labels});continue;}}
  if(p.courseContentStatus==='unpublished'&&p.pageKind==='course')throw Error('Unpublished course cannot count as course content');
  pages.push({eventId:row.eventId,raceDate:row.raceDate,checkedAt:p.checkedAt,url:p.url,kind:coursePagePublicationKind(p),sourceSha256:p.sha256,...(p.courseContentStatus==='unpublished'?{contentStatus:p.courseContentStatus}:{}),...(labels?.length?{distanceLabels:labels}:{})});
 }
 return pages.sort((a,b)=>a.eventId.localeCompare(b.eventId)||Number(b.kind==='course')-Number(a.kind==='course')||a.url.localeCompare(b.url));
}
