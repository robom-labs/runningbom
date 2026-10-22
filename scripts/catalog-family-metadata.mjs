import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {categoryLabels} from './catalog-core.mjs';
export const reviewedRegistry=JSON.parse(readFileSync(new URL('../data/catalog-reviewed-families.json',import.meta.url),'utf8'));
// Strip trademarks BEFORE NFKC: otherwise ™ becomes the model-changing letters TM.
const normalized=value=>String(value||'').replace(/[™®]/g,'').normalize('NFKC').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
const brandKey=value=>normalized(value);
function titleWithoutBoilerplate(product){
 let title=normalized(product.sourceTitle||product.model);
 const brand=normalized(product.brand);
 for(const prefix of [brand,...(brand==='nike'?['나이키']:[])])if(title.startsWith(prefix+' ')){title=title.slice(prefix.length+1);break;}
 // Color must equal the separately declared color, never an arbitrary model suffix.
 title=title.replace(/\s+-\s+size\s+\d+(?:\.\d+)?(?:\s*(?:us|uk|eu))?$/i,'');
 const color=normalized(product.color);
 if(color&&title.endsWith(' - '+color))title=title.slice(0,-(color.length+3)).trim();
 return title;
}
const permittedSuffix=/^(?:\s+(?:men's|women's|mens|womens|unisex|남성|여성|공용))?(?:\s+(?:road running shoes|running shoes|road racing shoes|로드 러닝화|로드 레이싱화))?$/;
export function matchReviewedFamily(product,registry=reviewedRegistry){
 const approved=registry.families.find(f=>f.id===product.id&&brandKey(f.brand)===brandKey(product.brand));
 if(approved)return approved;
 const title=titleWithoutBoilerplate(product),matches=[];
 for(const family of registry.families){
  if(brandKey(product.brand)!==brandKey(family.brand))continue;
  const aliases=[...new Set([family.model,family.modelEn].filter(Boolean).map(normalized))];
  if(aliases.some(alias=>title.startsWith(alias)&&permittedSuffix.test(title.slice(alias.length))))matches.push(family);
 }
 // Conflicting/multiple reviewed families are never resolved by fuzzy/short-prefix matching.
 return matches.length===1?matches[0]:null;
}
export function applyReviewedMetadata(product,registry=reviewedRegistry){
 const family=matchReviewedFamily(product,registry);
 if(!family)return {...product,category:'unknown',uses:[],purpose:'러닝화',tier:'러닝화'};
 return {...product,sourceTitle:product.sourceTitle||product.model,model:family.model,modelEn:family.modelEn||family.model,name:family.model,category:family.category,uses:[...family.uses],purpose:categoryLabels[family.category],tier:categoryLabels[family.category]};
}
export function repairCatalogMetadata(snapshot,registry=reviewedRegistry){
 const baselineIds=new Set(registry.families.map(p=>p.id)),mappings=[];
 const products=snapshot.products.map(product=>{
  if(baselineIds.has(product.id))return product;
  const next=applyReviewedMetadata(product,registry);
  if(JSON.stringify(next)!==JSON.stringify(product))mappings.push({id:product.id,sourceTitle:product.sourceTitle||product.model,canonicalId:matchReviewedFamily(product,registry)?.id||null,before:{model:product.model,category:product.category,uses:product.uses},after:{model:next.model,category:next.category,uses:next.uses}});
  return next;
 });
 const revision=mappings.length?'catalog-'+createHash('sha256').update(JSON.stringify(products)).digest('hex').slice(0,16):snapshot.revision;
 return {snapshot:{...snapshot,revision,products},mappings};
}
