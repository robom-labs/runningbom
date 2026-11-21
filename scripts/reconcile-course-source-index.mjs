// Offline lifecycle, not collection/approval. Bind the index to exact current
// public race bytes; never renew a source receipt or authorize new geometry.
import {readFile,writeFile,mkdir,rename,rm,lstat,realpath} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {courseDigest,disciplineKeys,safeCourseURL,courseDirectoryHost,mergeCourseDiscoveryIndex,plainCourseDivisionKey,currentCourseOption,courseDisciplineLiteral} from './course-discovery-core.mjs';
import {approveDiscoveredImages} from './course-discovery-approval.mjs';
import {courseSeedURLs} from './course-source-seeds.mjs';
import {verifyCourseSourceIndex} from './course-source-index-core.mjs';
import {buildCourseCatalog} from './course-catalog-build.mjs';
import {verifyCoursePair} from './course-data-publication.mjs';

const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),keys=v=>[...disciplineKeys(v)].sort();
const divisions=v=>v.map(courseDisciplineLiteral).sort();
// Legacy keys cannot establish run/walk/family scope. Accept only whole,
// explicit distance/category aliases, one label per key, with no extra words.
export {plainCourseDivisionKey};
export function losslessLegacyDivisions(labels,legacyKeys){
 if(!Array.isArray(labels)||!labels.length)return false;
 const parsed=labels.map(plainCourseDivisionKey);return parsed.every(Boolean)&&new Set(parsed).size===parsed.length&&same([...parsed].sort(),keys(legacyKeys));
}

// Global approved assets remain historical records. Current event coverage may
// retain only reconciled IDs, or regain an ID from independently qualified
// current source candidates, never from the global event/date registry alone.
export function finalizeCourseDiscoveryMembership(previous,observations,races,{baseCourses=[],approvedImages=[],acceptImages=false,now=Date.now()}={}){
 const candidates=observations.flatMap(r=>r.candidates||[]),scoped=candidates.filter(c=>{
  const race=races.find(r=>r.id===c.eventId);return race&&c.raceDate===race.raceDate&&c.eventName===race.name&&currentCourseOption(race,c.distanceLabel);
 });
 const images=scoped.filter(c=>c.sourceKind==='official-image');
 const sourcePages=observations.flatMap(r=>r.resolvedOfficialPages||[]);
 const approval=approveDiscoveredImages(approvedImages,images,races,{baseCourses,sourcePages,now});
 // Empty prior registry ensures a same-hash observation is still checked by
 // the existing exact-edition/raster/declared-discipline policy, not skipped.
 const qualified=approveDiscoveredImages([],images,races,{sourcePages,now}).approved;
 const registry=[...baseCourses,...(acceptImages?approval.approved:approvedImages)];
 const records=mergeCourseDiscoveryIndex(previous,observations,races).map(row=>{
  const race=races.find(r=>r.id===row.eventId),prior=previous?.records?.find(r=>r.eventId===row.eventId),observed=observations.find(r=>r.eventId===row.eventId);
  const binding=previous?.raceIdentityBindings?.[race.id];
  const retained=new Set(prior&&!prior.pendingReason&&prior.eventName===race.name&&prior.raceDate===race.raceDate&&binding?.name===race.name&&binding.raceDate===race.raceDate&&same(binding.distances,divisions(race.distances))?prior.approvedCourseIds||[]:[]);
  const eligible=c=>c.raceDate===race.raceDate&&(c.eventId===race.id||c.eventIds?.includes(race.id))&&currentCourseOption(race,c.distanceLabel);
  const fresh=c=>qualified.some(q=>q.eventId===race.id&&q.raceDate===race.raceDate&&q.sourceKind===c.sourceKind&&q.sourceSha256===c.sourceSha256&&q.sourceUrl===c.sourceUrl&&q.imageUrl===c.imageUrl&&currentCourseOption(race,q.distanceLabel)?.identity===currentCourseOption(race,c.distanceLabel)?.identity&&observed?.resolvedOfficialPages?.some(p=>p.verified&&p.url===q.discoveryEvidence.pageUrl&&p.sha256===q.discoveryEvidence.pageSha256&&p.checkedAt===q.discoveryEvidence.pageCheckedAt));
  const approvedCourseIds=registry.filter(c=>eligible(c)&&(retained.has(c.id)||fresh(c))).map(c=>c.id);
  return{...row,approvedCourseIds,...(prior?.pendingReason&&!approvedCourseIds.length?{pendingReason:prior.pendingReason}:{})};
 });
 const scopeQuarantine=candidates.filter(c=>!scoped.includes(c)).map(c=>({id:c.id,eventId:c.eventId,reason:'current-literal-discipline-or-name-unproven'}));
 approval.quarantine.push(...scopeQuarantine.filter(q=>candidates.some(c=>c.id===q.id&&c.sourceKind==='official-image')));
 return{records,approval,eligibleImageCandidates:images,scopeQuarantine,historicalApprovedRowsUnchanged:!acceptImages};
}
export function reconcileCourseSourceIndex(previous,raceBytes,{now=Date.now(),seedManifest}={}){
 const races=JSON.parse(raceBytes.toString()).races;
 if(!Array.isArray(races)||!races.length||races.length>1000||new Set(races.map(r=>r.id)).size!==races.length||races.some(r=>!r.id||!r.name||!/^\d{4}-\d{2}-\d{2}$/.test(r.raceDate)||!Array.isArray(r.distances)))throw Error('Invalid exact current race snapshot');
 if(!Array.isArray(previous?.records)||previous.records.some(r=>typeof r.eventName!=='string'||!Array.isArray(r.distanceKeys))||previous.lifecycleArchive!==undefined&&!Array.isArray(previous.lifecycleArchive))throw Error('Invalid prior index identity');
 // Validate old evidence against its old identities, NOT the new membership.
 // Expired receipts may be archived, but corrupt/future evidence is never trusted.
 verifyCourseSourceIndex(previous,previous.records.map(r=>({id:r.eventId,raceDate:r.raceDate,distances:r.distanceKeys})),{now,maxAgeDays:Infinity});
 const old=new Map(previous.records.map(r=>[r.eventId,r])),ids=new Set(races.map(r=>r.id)),today=new Date(now+9*3600000).toISOString().slice(0,10);
 const retired=previous.records.filter(r=>!ids.has(r.eventId));
 if(retired.some(r=>r.raceDate>=today))throw Error('Missing current/future identity requires review; last good retained');
 const archived=[...(previous.lifecycleArchive||[])],changes=[];
 const archive=(row,reason)=>{const entry={reason,previousSourceSnapshotSha256:previous.sourceSnapshotSha256,row:structuredClone(row)};if(!archived.some(a=>same(a,entry)))archived.push(entry);};
 for(const row of retired){archive(row,'retired-past-identity');changes.push({eventId:row.eventId,reason:'retired-past-identity'});}
 function pending(race,reason){
  // Only actual declarations. Do not upgrade HTTP to a guessed HTTPS endpoint.
  const seeds=[...courseSeedURLs(race,seedManifest),race.officialUrl].filter(u=>safeCourseURL(u)&&!courseDirectoryHost(new URL(u).hostname));
  return{eventId:race.id,eventName:race.name,raceDate:race.raceDate,distanceKeys:disciplineKeys(race.distances),seedUrls:[...new Set(seeds)].slice(0,3),status:'pending-revalidation',pendingReason:reason,resolvedOfficialPages:[],navigationFrontier:[],approvedCourseIds:[]};
 }
 const records=races.map(race=>{
  const row=old.get(race.id);let reason;
  if(!row)reason='new-event';else if(row.raceDate!==race.raceDate)reason='edition-changed';else if(row.eventName!==race.name)reason='name-changed';else if(!same(keys(row.distanceKeys),keys(race.distances))||previous.raceIdentityBindings?.[race.id]&&!same(previous.raceIdentityBindings[race.id].distances,divisions(race.distances)))reason='disciplines-changed';else if(!previous.raceIdentityBindings?.[race.id]&&!losslessLegacyDivisions(race.distances,row.distanceKeys))reason='legacy-division-identity-unproven';
  if(reason){if(row)archive(row,reason);changes.push({eventId:race.id,reason});return pending(race,reason);}
  if(row.resolvedOfficialPages.some(p=>now-Date.parse(p.checkedAt)>30*86400000)){archive(row,'source-evidence-expired');changes.push({eventId:race.id,reason:'source-evidence-expired'});return pending(race,'source-evidence-expired');}
  return structuredClone(row);
 });
 const raceIdentityBindings=Object.fromEntries(races.map(r=>[r.id,{name:r.name,raceDate:r.raceDate,distances:divisions(r.distances)}]));
 const sourceSnapshotSha256=courseDigest(raceBytes),unchanged=sourceSnapshotSha256===previous.sourceSnapshotSha256&&same(previous.records,records)&&same(previous.lifecycleArchive||[],archived)&&same(previous.raceIdentityBindings,raceIdentityBindings);
 const index=unchanged?structuredClone(previous):{...structuredClone(previous),sourceSnapshotSha256,sourceRecordCount:races.length,records,raceIdentityBindings,...(archived.length?{lifecycleArchive:archived}:{}),lifecycle:{method:'exact-race-bytes-offline-reconciliation',previousIndexSha256:courseDigest(JSON.stringify(previous)),previousSourceSnapshotSha256:previous.sourceSnapshotSha256,changes,sourceReceiptTimestampsUnchanged:true,historicalSourceBytesVerified:false}};
 const validation=verifyCourseSourceIndex(index,races,{now,raceBytes});
 return{index,races,changed:!unchanged,changes,validation};
}

export const lifecycleInputs=['apps/mobile/src/data/races.json','data/course-source-index.json','data/course-source-seeds.json','data/course-base.json','data/course-approved-images.json','data/course-elevation.json','data/course-catalog.json','data/course-catalog.manifest.json'];
export const lifecycleOutputs=['data/course-source-index.json','data/course-catalog.json','data/course-catalog.manifest.json'];
async function capture(root){const bytes={};for(const p of lifecycleInputs){const f=join(root,p);if(await realpath(f)!==f||!(await lstat(f)).isFile())throw Error('Lifecycle input symlink/nonregular file');bytes[p]=await readFile(f);}return bytes;}
export async function reconcileCourseMetadata(root,{write=false,now=Date.now(),beforeApply,renameFile=rename}={}){
 root=resolve(root);if(await realpath(root)!==root||await realpath(join(root,'data'))!==join(root,'data'))throw Error('Physical lifecycle root/data required');
 const lock=join(root,'data/.course-index-lifecycle.lock');await mkdir(lock);let staged=[],applied=[],original,candidates;
 const report={schemaVersion:1,state:'VALIDATING',checkedAt:new Date(now).toISOString(),sourceReceiptTimestampsUnchanged:true,remoteMutation:false};
 try{
  original=await capture(root);const json=p=>JSON.parse(original[p]),raceBytes=original[lifecycleInputs[0]],plan=reconcileCourseSourceIndex(json(lifecycleInputs[1]),raceBytes,{now,seedManifest:json(lifecycleInputs[2])});
  const courses=[...json('data/course-base.json'),...json('data/course-approved-images.json')],elevation=json('data/course-elevation.json'),old=json('data/course-catalog.json');
  const built=buildCourseCatalog({courses,elevation,index:plan.index,races:plan.races,raceBytes,now});
  if(!same(old.courses,built.catalog.courses)||!same(old.elevation,built.catalog.elevation))throw Error('Course/elevation projection drift; lifecycle cannot replace it');
  verifyCoursePair(built.text,built.manifest,{approvedCourses:courses,now});
  candidates={};candidates[lifecycleOutputs[0]]=plan.changed?Buffer.from(JSON.stringify(plan.index,null,2)+'\n'):original[lifecycleOutputs[0]];candidates[lifecycleOutputs[1]]=Buffer.from(built.text);candidates[lifecycleOutputs[2]]=Buffer.from(built.manifestText);
  const changed=lifecycleOutputs.filter(p=>!candidates[p].equals(original[p]));
  Object.assign(report,{state:'VALIDATED_NOT_APPLIED',inputHashes:Object.fromEntries(lifecycleInputs.map(p=>[p,courseDigest(original[p])])),candidateHashes:Object.fromEntries(lifecycleOutputs.map(p=>[p,courseDigest(candidates[p])])),changed,changes:plan.changes,sourceSnapshotSha256:plan.index.sourceSnapshotSha256,recordCount:plan.races.length});
  if(!write){if(changed.length)throw Error('Course lifecycle drift; run reconciliation before publication');return report;}
  for(const p of changed){const temp=join(root,p)+'.lifecycle-'+process.pid;await writeFile(temp,candidates[p],{flag:'wx'});staged.push([p,temp]);}
  if(beforeApply)await beforeApply();
  const assertCAS=async()=>{const live=await capture(root);for(const p of lifecycleInputs)if(!live[p].equals(applied.includes(p)?candidates[p]:original[p]))throw Error('Concurrent lifecycle input drift; no retry');};
  await assertCAS();
  for(const [p,temp]of staged){await assertCAS();await renameFile(temp,join(root,p));applied.push(p);}
  await assertCAS();report.state=changed.length?'APPLIED_LOCAL_METADATA':'UNCHANGED';return report;
 }catch(error){
  // Best-effort ownership checks, NOT atomic filesystem CAS or a multi-file
  // transaction. Nonparticipating writers can race between check and rename.
  // Observed ownership conflicts are preserved and require reconciliation.
  let conflict=false;for(const p of [...applied].reverse()){if(await realpath(join(root,p))!==join(root,p)){conflict=true;continue;}const live=await readFile(join(root,p));if(!live.equals(candidates[p])){conflict=true;continue;}const temp=join(root,p)+'.lifecycle-restore-'+process.pid;await writeFile(temp,original[p],{flag:'wx'});await rename(temp,join(root,p));}
  report.state=conflict?'PARTIAL_REQUIRES_RECONCILIATION':'REFUSED_LAST_GOOD_PRESERVED';report.error=error.message;error.lifecycleReport=report;throw error;
 }finally{for(const [,temp]of staged)await rm(temp,{force:true});await rm(lock,{recursive:true});}
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2);if(args.some(a=>!['--write','--check'].includes(a))||args.length!==1)throw Error('Use exactly --write or --check');
 const root=fileURLToPath(new URL('../',import.meta.url)),head=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();let report;
 try{report=await reconcileCourseMetadata(root,{write:args[0]==='--write',beforeApply:()=>{if(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==head)throw Error('Git HEAD drift');}});}catch(e){report=e.lifecycleReport||{state:'REFUSED_LAST_GOOD_PRESERVED',error:e.message};process.exitCode=1;}
 report.gitHead=head;const text=JSON.stringify(report,null,2)+'\n',dir=join(root,'outputs/operations');await mkdir(dir,{recursive:true});const receipt=join(dir,'course-index-lifecycle-'+courseDigest(text)+'.json');try{await writeFile(receipt,text,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
 await writeFile(join(dir,'course-index-lifecycle.json'),text);console.log(text);
}
