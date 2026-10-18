import {z} from 'zod';
export const verifiedShoeSchema=z.object({
 id:z.string(),brand:z.string(),model:z.string(),name:z.string(),modelEn:z.string().optional(),description:z.string(),
 source:z.string().url().startsWith('https://'),imageSource:z.string().url().startsWith('https://'),image:z.string(),imageSha256:z.string().nullable().optional(),
 price:z.number().positive().nullable(),currency:z.string().regex(/^[A-Z]{3}$/),sourceRegion:z.string(),sku:z.string().nullable(),color:z.string(),
 category:z.enum(['daily','cushion','stability','supertrainer','speed','carbon','trail','unknown']),uses:z.array(z.string()),
 purpose:z.string(),plate:z.string(),weight:z.string(),drop:z.string(),checkedAt:z.iso.datetime({offset:true}),
 release:z.string(),releaseSource:z.string(),upcoming:z.boolean(),gender:z.string(),
}).passthrough();
export type VerifiedShoe=z.infer<typeof verifiedShoeSchema>;
export const catalogSchema=z.object({schemaVersion:z.literal(1),revision:z.string(),generatedAt:z.iso.datetime({offset:true}),products:z.array(verifiedShoeSchema).min(1)})
 .refine(d=>new Set(d.products.map(p=>p.id)).size===d.products.length,'duplicate product ID');
export type VerifiedCatalog=z.infer<typeof catalogSchema>;
export function acceptCatalog(current:VerifiedCatalog,next:unknown):VerifiedCatalog{
 const parsed=catalogSchema.parse(next);
 if(Date.parse(parsed.generatedAt)<Date.parse(current.generatedAt))throw new Error('older catalog');
 return parsed;
}
export const categoryNames:Record<string,string>={daily:'데일리',cushion:'쿠션',stability:'안정화',supertrainer:'슈퍼트레이너',speed:'스피드',carbon:'카본',trail:'트레일',unknown:''};
export function shoePrice(p:Pick<VerifiedShoe,'price'|'currency'>){return p.price===null?'':p.currency==='KRW'?`${p.price.toLocaleString('ko-KR')}원`:`${p.currency} ${p.price.toLocaleString('ko-KR')}`;}
export function compareShoePrices(a:Pick<VerifiedShoe,'price'|'currency'>,b:Pick<VerifiedShoe,'price'|'currency'>,descending=false){
 return Number(b.currency==='KRW')-Number(a.currency==='KRW')||a.currency.localeCompare(b.currency)||Number(a.price===null)-Number(b.price===null)||((a.price??0)-(b.price??0))*(descending?-1:1);
}
