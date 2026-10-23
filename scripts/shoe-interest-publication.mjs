// Publish the existing measured-interest artifact at the exact URL read by usePopularity.
import {readFile,writeFile,mkdir,readdir,lstat} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),hash=v=>createHash('sha256').update(v).digest('hex');
export const interestPublicationAllowlist=['data/catalog/shoe-interest.json','data/catalog/shoe-interest.manifest.json'];
export function interestManifest(text){const d=JSON.parse(text);return {schemaVersion:1,sha256:hash(text),count:d.rows.length,checkedAt:d.checkedAt};}
export function verifyInterestPair(text,manifest,{now=Date.now(),fresh=true,products}={}){
 const d=JSON.parse(text),at=Date.parse(d.checkedAt),seen=new Set(),ids=products&&new Set(products.map(p=>p.id));
 if(manifest.schemaVersion!==1||d.schemaVersion!==1||manifest.sha256!==hash(text)||manifest.checkedAt!==d.checkedAt||!Array.isArray(d.rows)||manifest.count!==d.rows.length||d.rows.length<5||d.source!=='RunRepeat'||d.metric!=='published-page-views'||d.complete!==true||d.sourceUrl!=='https://runrepeat.com/catalog/running-shoes'||!Number.isFinite(at)||at>now+300000||(fresh&&now-at>72*3600000))throw Error('Invalid/expired measured-interest pair');
 for(const r of d.rows){let u;try{u=new URL(r.evidenceUrl);}catch{throw Error('Interest evidence URL missing');}if(!/^[a-zA-Z0-9_-]{1,150}$/.test(r.item_id??'')||seen.has(r.item_id)||!Number.isSafeInteger(r.rank)||r.rank<1||!Number.isSafeInteger(r.value)||r.value<1||u.protocol!=='https:'||u.hostname!=='runrepeat.com'||u.username||u.password||u.port||!/^\/[a-z0-9-]+\/?$/.test(u.pathname)||['catalog','ranking','about'].includes(u.pathname.replaceAll('/',''))||(ids&&!ids.has(r.item_id)))throw Error('Invalid measured-interest record/source');seen.add(r.item_id);}
 return {count:d.rows.length,checkedAt:d.checkedAt,sha256:manifest.sha256,source:d.source};
}
async function tree(dir,prefix='') {const out={};for(const e of await readdir(join(dir,prefix),{withFileTypes:true})){if(e.name==='.git')continue;const p=prefix?prefix+'/'+e.name:e.name,s=await lstat(join(dir,p));if(s.isSymbolicLink())throw Error('Symlink in publication tree');if(s.isDirectory())Object.assign(out,await tree(dir,p));else if(s.isFile())out[p]=hash(await readFile(join(dir,p)));}return out;}
export function assertInterestOnlyDelta(before,after){const changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(p=>before[p]!==after[p]);if(changed.some(p=>!interestPublicationAllowlist.includes(p)))throw Error('Non-interest file mutation refused');return changed;}
export function assertInterestPagesSource(c){if(c?.build_type!=='legacy'||c?.source?.branch!=='gh-pages'||c?.source?.path!=='/')throw Error('Existing Pages source must remain unchanged');}
async function pair(dir){return Promise.all(['shoe-interest.json','shoe-interest.manifest.json'].map(p=>readFile(join(dir,p),'utf8')));}
export async function overlayInterest(siteDir,dataDir,{now=Date.now(),products}={}){
 const [text,m]=await pair(dataDir),report=verifyInterestPair(text,JSON.parse(m),{now,products}),before=await tree(siteDir);
 const present=interestPublicationAllowlist.map(p=>Object.hasOwn(before,p));if(present.some(Boolean)&&!present.every(Boolean))throw Error('Incomplete previous interest pair');
 if(present.every(Boolean)){const [old,om]=await pair(join(siteDir,'data/catalog')),oldData=JSON.parse(old),currentData=JSON.parse(text);verifyInterestPair(old,JSON.parse(om),{now,fresh:false});if(Date.parse(currentData.checkedAt)<Date.parse(oldData.checkedAt)||(currentData.checkedAt===oldData.checkedAt&&JSON.stringify(currentData.rows)!==JSON.stringify(oldData.rows)))throw Error('Interest downgrade/conflicting observation');}
 await mkdir(join(siteDir,'data/catalog'),{recursive:true});await writeFile(join(siteDir,interestPublicationAllowlist[0]),text);await writeFile(join(siteDir,interestPublicationAllowlist[1]),m);
 return {...report,changed:assertInterestOnlyDelta(before,await tree(siteDir)),nonInterestFilesUnchanged:true};
}
async function publicText(url,fetcher){const r=await fetcher(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Public interest HTTP '+r.status);const n=Number(r.headers.get('content-length'));if(n>1_000_000)throw Error('Interest feed too large');let size=0,parts=[];for await(const x of r.body){size+=x.byteLength;if(size>1_000_000)throw Error('Interest feed too large');parts.push(Buffer.from(x));}return Buffer.concat(parts).toString('utf8');}
export async function verifyPublicInterest(dataDir,{fetcher=fetch,now=Date.now()}={}){const [local,lm]=await pair(dataDir),expected=verifyInterestPair(local,JSON.parse(lm),{now}),[text,m]=await Promise.all(interestPublicationAllowlist.map(p=>publicText('https://robom-labs.github.io/runningbom/'+p+'?interest-check='+now,fetcher))),report=verifyInterestPair(text,JSON.parse(m),{now});if(report.sha256!==expected.sha256)throw Error('Served interest differs from candidate');return {...report,actualPublicPairVerified:true};}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const args=process.argv.slice(2),val=flag=>args.includes(flag)?args[args.indexOf(flag)+1]:undefined,dataDir=resolve(val('--data-dir')||join(root,'data'));
 if(args.includes('--assert-pages')){let s='';for await(const x of process.stdin)s+=x;assertInterestPagesSource(JSON.parse(s));console.log('Existing Pages configuration verified');}
 else if(args.includes('--verify-public'))console.log(JSON.stringify(await verifyPublicInterest(dataDir)));
 else {const products=JSON.parse(await readFile(join(dataDir,'verified-products.json'),'utf8')).products;if(args.includes('--check')){const [text,m]=await pair(dataDir);console.log(JSON.stringify(verifyInterestPair(text,JSON.parse(m),{products})));}else{const site=val('--site-dir');if(!site)throw Error('--site-dir, --check or --verify-public required');console.log(JSON.stringify(await overlayInterest(resolve(site),dataDir,{products})));}}
}
