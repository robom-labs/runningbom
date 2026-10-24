// Controlled OWNER candidate generator. No catalog, app or remote writes.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {exactFrameForProduct} from './product-frame-audit-core.mjs';
export function mergeReviewedPhotoFrames(catalog,candidates,approvals=[],now=Date.now()){
 if(new Set(approvals.map(a=>a.id)).size!==approvals.length)throw Error('Duplicate source-identity approval ID');
 const byId=new Map(approvals.map(a=>[a.id,a])),report={attached:0,originalHashChanges:0,awaitingApproval:[],unmatchedCandidate:[],expiredOrInvalid:[],removedStaleFrames:[]};
 const products=catalog.products.map(original=>{
  let p=original;
  if(p.imageFrame&&!exactFrameForProduct(p.imageFrame,p,now)){const {imageFrame,...clean}=p;p=clean;report.removedStaleFrames.push(p.id);}
  const f=candidates[p.id];if(!f)return p;
  if(f.imageSource!==p.imageSource||f.productSource!==p.source){report.unmatchedCandidate.push(p.id);return p;}
  let next=p;
  if(p.imageSha256!==f.sha256){
   const a=byId.get(p.id),valid=a&&a.approved===true&&a.imageSource===p.imageSource&&a.productSource===p.source&&a.sha256===f.sha256&&a.identitySource===p.source&&/^[a-f0-9]{64}$/.test(a.identityEvidenceSha256||'')&&typeof a.reviewer==='string'&&a.reviewer.length>0&&Number.isFinite(Date.parse(a.reviewedAt))&&Date.parse(a.reviewedAt)<=now;
   if(!valid){report.awaitingApproval.push(p.id);return p;}
   next={...p,imageSha256:f.sha256,imageCheckedAt:f.checkedAt,imageVerification:'original-bytes'};
   // Old bundled/local paths must not masquerade as the newly measured bytes.
   if(next.image!==next.imageSource)next={...next,image:next.imageSource};
  }
  const frame=exactFrameForProduct(f,next,now);if(!frame){report.expiredOrInvalid.push(p.id);return p;}
  report.attached++;if(next.imageSha256!==p.imageSha256)report.originalHashChanges++;
  return {...next,imageFrame:frame};
 });
 return {catalog:{...catalog,products},report};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),get=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
 const defaults=resolve(dirname(fileURLToPath(import.meta.url)),'../outputs/operations/shoe-photo-audit'),out=resolve(get('--out',defaults)),input=resolve(get('--catalog',resolve(defaults,'catalog-snapshot.json'))),reviewPath=get('--approvals',null),framesPath=resolve(get('--frames',resolve(defaults,'candidate-frames-owner-review.json')));
 const catalogTarget=resolve(out,'candidate-catalog-with-frames.json'),manifestTarget=resolve(out,'candidate-catalog-with-frames.manifest.json');
 if([catalogTarget,manifestTarget].includes(input)||[catalogTarget,manifestTarget].includes(framesPath)||(reviewPath&&[catalogTarget,manifestTarget].includes(resolve(reviewPath))))throw Error('Output would overwrite an input');
 const base=await readFile(input),catalog=JSON.parse(base),candidates=JSON.parse(await readFile(framesPath,'utf8')).candidates,approvals=reviewPath?JSON.parse(await readFile(resolve(reviewPath),'utf8')).approved:[];
 const result=mergeReviewedPhotoFrames(catalog,candidates,approvals);
 const bytes=JSON.stringify(result.catalog,null,2)+'\n',hash=b=>createHash('sha256').update(b).digest('hex');
 await mkdir(out,{recursive:true});
 await writeFile(catalogTarget,bytes);
 await writeFile(manifestTarget,JSON.stringify({schemaVersion:1,revision:'photo-candidate-'+hash(bytes).slice(0,16),sha256:hash(bytes),bytes:Buffer.byteLength(bytes),products:catalog.products.length,originalInputSha256:hash(base),framesInput:framesPath,reviewedInput:!!reviewPath,generatedAt:new Date().toISOString(),report:result.report},null,2)+'\n');
 console.log(JSON.stringify({...result.report,awaitingApproval:result.report.awaitingApproval.length,unmatchedCandidate:result.report.unmatchedCandidate.length,expiredOrInvalid:result.report.expiredOrInvalid.length},null,2));
}
