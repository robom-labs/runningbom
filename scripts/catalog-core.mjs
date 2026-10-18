// Schema.org + official catalog adapters. Crawlee owns requests/retries/robots.
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {publicationFields} from './catalog-publication-core.mjs';
export const categoryLabels = {daily:'입문·매일 러닝',cushion:'푹신한 쿠션',stability:'탄탄한 지지',supertrainer:'슈퍼 트레이너',speed:'빠른 훈련',carbon:'대회용 카본',trail:'트레일',unknown:'분류 확인 중'};
const https = z.string().url().refine(v=>new URL(v).protocol==='https:' && !new URL(v).username && !new URL(v).password);
export const productSchema = z.object({
 id:z.string().min(3),brand:z.string().min(1),model:z.string().min(2),name:z.string().min(2),
 source:https,imageSource:https,image:z.string().min(1),checkedAt:z.iso.datetime({offset:true}),
 price:z.number().positive().nullable(),regularPrice:z.number().positive().nullable(),currency:z.string().regex(/^[A-Z]{3}$/),sourceRegion:z.string().min(1),
 sku:z.string().nullable(),color:z.string().min(1),gender:z.string(),category:z.enum(Object.keys(categoryLabels)),uses:z.array(z.enum(['daily','recovery','long','tempo','interval','race','trail'])),
 purpose:z.string(),tier:z.string(),description:z.string(),plate:z.string(),weight:z.string(),drop:z.string(),
 release:z.string().regex(/^(?:\d{4}-\d{2}(?:-\d{2})?)?$/),releaseRegion:z.string(),releaseSource:z.string(),upcoming:z.boolean(),merchant:z.string(),priceType:z.string(),imageSha256:z.string().regex(/^[a-f0-9]{64}$/).nullable(),
}).passthrough();
export function fingerprint(p){return `${p.brand}|${p.modelEn || p.model}`.normalize('NFKC').toLowerCase().replace(/[\s®™·._-]/g,'');}
export function flattenLd(value){
 if(Array.isArray(value))return value.flatMap(flattenLd);
 if(!value || typeof value!=='object')return [];
 return [value,...flattenLd(value['@graph']),...flattenLd(value.hasVariant),...flattenLd(value.itemListElement),...flattenLd(value.item)];
}
export function declaredReleaseDate(value){
 if(typeof value!=='string')return undefined;
 const match=value.match(/^(20\d{2}-\d{2}(?:-\d{2})?)(?:T|$)/);if(!match)return undefined;
 const date=match[1],day=date.length===7?date+'-01':date;
 const parsed=new Date(day+'T00:00:00Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===day?date:undefined;
}
export function declaredProductGender(value,url='',name=''){
 const declared=String(value||'').toLowerCase();
 if(/^(?:unisex|공용|남녀공용)$/.test(declared))return '공용';
 if(/^(?:female|women|womens|여성)$/.test(declared))return '여성';
 if(/^(?:male|men|mens|남성)$/.test(declared))return '남성';
 let source=url;try{source=decodeURIComponent(url);}catch{/* Keep the observed URL. */}
 const text=(source+' '+name).toLowerCase();
 if(/여성|(?:^|[\s/-])women(?:s|'s)?(?:[\s/-]|$)/.test(text))return '여성';
 if(/남성|(?:^|[\s/-])men(?:s|'s)?(?:[\s/-]|$)/.test(text))return '남성';
 return '미확인';
}
export function releaseIsUpcoming(release,now=new Date()){
 if(!release)return false;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(now);
 return release.length===7?release>today.slice(0,7):release>today;
}
export function pressReleaseDate(text,publishedYear){
 const section=String(text).split(/when\s+is\s+it\s+available\s*\??/i)[1]?.slice(0,650);if(!section)return undefined;
 const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
 const match=section.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:(20\d{2})\b|(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(20\d{2}))?\b)/i);
 if(!match)return undefined;const year=match[2]||match[4]||String(publishedYear||'');if(!/^20\d{2}$/.test(year))return undefined;
 return declaredReleaseDate(year+'-'+String(months.indexOf(match[1].toLowerCase())+1).padStart(2,'0')+(match[3]?'-'+match[3].padStart(2,'0'):''));
}
export function announcementForCatalog(products,candidate){
 const retail=products.find(p=>fingerprint(p)===fingerprint(candidate));
 if(!retail?.sku||retail.evidenceKind==='official-announcement')return candidate;
 const hasDate=!!retail.release;const release=retail.release||candidate.release;
 return {...retail,release,releaseSource:hasDate?retail.releaseSource:candidate.releaseSource,releaseRegion:hasDate?retail.releaseRegion:candidate.releaseRegion,upcoming:releaseIsUpcoming(release),announcementCheckedAt:candidate.checkedAt};
}
export function extractProductCandidates($,url,source){
 const found=[];
 $('script[type="application/ld+json"]').each((_,node)=>{
  try {for(const p of flattenLd(JSON.parse($(node).text()))){
   if(!['Product','ProductGroup'].includes(p['@type']))continue;
   const offer=Array.isArray(p.offers)?p.offers[0]:p.offers;
   const image=Array.isArray(p.image)?p.image[0]:p.image;
   const name=String(p.name || '').trim();
   if(!name || !image || !offer || !offer.priceCurrency)continue;
   const brand=typeof p.brand==='object'?p.brand.name:p.brand;
   if(brand && !String(brand).toLowerCase().includes(source.brand.toLowerCase()) && !source.aliases?.some(a=>String(brand).toLowerCase().includes(a.toLowerCase())))continue;
   const release=declaredReleaseDate(p.releaseDate);
   found.push({brand:source.brand,model:name,source:offer.url || p.url || url,imageSource:typeof image==='string'?image:image.url,...(release?{release}:{}),
    sku:p.mpn || p.sku || null,color:p.color || null,price:Number(offer.price),currency:offer.priceCurrency,sourceRegion:source.region,
    description:p.description || '',gender:declaredProductGender(p.gender||p.audience?.suggestedGender||source.gender,offer.url||p.url||url,name),evidenceKind:'schema.org'});
  }}catch{/* An unrelated malformed JSON-LD block doesn't authorize filling gaps. */}
 });
 // Nike publishes exact model, colorway, product code, currency and image together.
 const next=$('script#__NEXT_DATA__').text();
 if(source.adapter==='nike' && next){
  try{
   const groups=JSON.parse(next).props?.pageProps?.initialState?.Wall?.productGroupings || [];
   for(const group of groups)for(const p of group.products || []){
    if(!/러닝|레이싱/.test(p.copy?.subTitle || '') || /주니어|베이비/.test(p.copy?.subTitle || ''))continue;
    found.push({brand:'NIKE',model:p.copy.title.replace(/^나이키\s*/,''),source:p.pdpUrl.url,sku:p.productCode,
     color:p.displayColors?.colorDescription,imageSource:p.colorwayImages?.squarishURL,price:p.prices.currentPrice,
     regularPrice:p.prices.initialPrice,currency:p.prices.currency,gender:/여성/.test(p.copy.subTitle)?'여성':/남성/.test(p.copy.subTitle)?'남성':'공용',sourceRegion:'한국',description:'',evidenceKind:'official-catalog'});
   }
  }catch{/* Fails closed and retains previous data. */}
 }
 return found;
}
export function classify(name,description=''){
 const text=(name+' '+description).toLowerCase();
 if(/trail|트레일|trabuco|speedcross|sense ride|terrex|challenger|speedgoat|timp|olympus/.test(text))return ['trail',['trail']];
 if(/vaporfly|alphafly|swooshfly|\bapex\b|metaspeed|adios pro|adizero pro|endorphin pro|endorphin elite|rocket x|cielo x|hyperion elite|fast-r|fast r|deviate nitro elite|sc elite|cloudboom|카본 레이싱/.test(text))return ['carbon',['race']];
 if(/kayano|gt-2000|gt-1000|structure|arahi|gaviota|adrenaline|glycerin gts|hurricane|tempus|guide\s*\d|inspire|infinityrn|stability|안정화/.test(text))return ['stability',['daily','long']];
 if(/superblast|megablast|sonicblast|zoom fly|boston|endorphin speed|mach x|skyward x|sc trainer|deviate nitro|neo vista|super.?trainer/.test(text))return ['supertrainer',['long','interval']];
 if(/rival fly|streakfly|takumi|adios\s*\d|hyperion\s*\d|mach\s*\d|kinvara|tempo|speed trainer|interval/.test(text))return ['speed',['interval','daily']];
 if(/nimbus|cumulus|vomero|bondi|clifton|glycerin|ghost max|1080|more v|triumph|cloudmonster|cloudsurfer|max cushion|쿠셔닝/.test(text))return ['cushion',['daily','long']];
 if(/pegasus|winflo|novablast|contend|revolution|quest|downshifter|supernova|duramo|ghost|ride\s*\d|revel|880|1080|daily|everyday|일상|조깅/.test(text))return ['daily',['daily']];
 return ['unknown',[]];
}
export function mergeVerified(previous,incoming){
 const byId=new Map(previous.map(p=>[p.id,publicationFields(p)]));const byModel=new Map(previous.map(p=>[fingerprint(p),p.id]));let added=0,updated=0;
 for(const candidate of incoming){
  const parsed=productSchema.safeParse(candidate);if(!parsed.success)throw new Error(`invalid candidate ${candidate.id}: ${parsed.error.issues[0].message}`);
  const p=publicationFields(parsed.data);const oldId=byModel.get(fingerprint(p));
  if(oldId){
   const old=byId.get(oldId);
   // A different representative color must not overwrite a product's price/photo.
   if(old.sku && p.sku && old.sku!==p.sku)continue;
   if(Date.parse(p.checkedAt)<Date.parse(old.checkedAt))continue;
   const evidence=old.useEvidence||[];
   byId.set(oldId,{...old,...p,id:oldId,image:p.image,useEvidence:evidence,uses:[...new Set([...p.uses,...evidence.map(item=>item.use)])]});updated++;
  }else {byId.set(p.id,p);byModel.set(fingerprint(p),p.id);added++;}
 }
 return {products:[...byId.values()],added,updated};
}
export function sha256(bytes){return createHash('sha256').update(bytes).digest('hex');}
