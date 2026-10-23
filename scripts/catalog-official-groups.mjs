import {createHash} from 'node:crypto';

const hosts=new Set(['brooksrunning.com.au','www.brooksrunning.com.au']);
function officialUrl(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&hosts.has(u.hostname)?u:null;}catch{return null;}
}
function nodes(value){
 if(Array.isArray(value))return value.flatMap(nodes);
 if(!value||typeof value!=='object')return [];
 return [value,...nodes(value['@graph']),...nodes(value.hasVariant),...nodes(value.itemListElement),...nodes(value.item)];
}
function identity(u){const v=new URL(u);v.hostname='brooksrunning.com.au';v.hash='';v.searchParams.sort();return v.href;}

// Only explicit official ProductGroup ancestry authorizes model grouping. In
// particular, never strip size/color words from a product's marketing name.
export function officialBrooksGroups($,pageUrl,checkedAt=new Date().toISOString()){
 const page=officialUrl(pageUrl);if(!page)return [];
 const canonical=officialUrl($('link[rel="canonical"]').attr('href'));
 if(!canonical||canonical.pathname!==page.pathname)return [];
 const out=[];
 $('script[type="application/ld+json"]').each((_,node)=>{
  let json;try{json=JSON.parse($(node).text());}catch{return;}
  for(const group of nodes(json)){
   if(group['@type']!=='ProductGroup'||!Array.isArray(group.hasVariant))continue;
   const id=String(group.productGroupID||''),name=String(group.name||'').trim();
   const brand=typeof group.brand==='object'?group.brand.name:group.brand;
   if(!/^\d{6}$/.test(id)||!name||String(brand).toLowerCase()!=='brooks')continue;
   if(!canonical.pathname.endsWith('/'+id+'.html'))continue;
   const gender=/-womens-/.test(canonical.pathname)?'여성':/-mens-/.test(canonical.pathname)?'남성':null;
   if(!gender)continue;
   canonical.search='';canonical.hash='';canonical.hostname='brooksrunning.com.au';
   const evidence={kind:'official-product-group',sourceUrl:canonical.href,productGroupID:id,parentName:name,checkedAt,schemaSha256:createHash('sha256').update(JSON.stringify(group)).digest('hex')};
   const variants=[];
   for(const child of group.hasVariant){
    const u=officialUrl(child.url),sku=String(child.sku||''),width=u?.searchParams.get('width'),size=String(child.size||'');
    const declaredWidth=String(child.width||'');
    if(child['@type']!=='Product'||!u||u.pathname!==canonical.pathname||!sku||!width||!/^[A-Z0-9]{1,4}$/.test(width))continue;
    if(!(declaredWidth===width||declaredWidth.endsWith('('+width+')'))||!size||u.searchParams.get('size')!==size)continue;
    variants.push({url:identity(u),sku,width,size,widthLabel:declaredWidth,color:child.color});
   }
   if(variants.length)out.push({id,name,gender,canonical:canonical.href,variants,evidence});
  }
 });
 return out;
}

export function officialGroupMetadata(product,groups){
 const u=officialUrl(product.source);
 if(!u||String(product.brand).toLowerCase()!=='brooks'||product.currency!=='AUD')return null;
 const group=groups.find(g=>new URL(g.canonical).pathname===u.pathname);
 if(!group||product.gender&&product.gender!=='미확인'&&product.gender!==group.gender)return null;
 const size=u.searchParams.get('size'),width=u.searchParams.get('width');
 const child=group.variants.find(v=>size? v.url===identity(u)&&v.sku===String(product.sku):String(product.sku)===group.id&&v.width===width&&new URL(v.url).searchParams.get('colour')===u.searchParams.get('colour'));
 if(!child)return null;
 return {model:group.name,modelEn:group.name,name:group.name,modelGroup:'brooks-au:'+group.id,width:child.width,widthLabel:child.widthLabel,gender:group.gender,...(size?{size:child.size}:{}),officialProductGroup:group.id,modelGroupEvidence:group.evidence};
}

export function isOfficialBrooksSizeVariant(product){const u=officialUrl(product.source);return String(product.brand).toLowerCase()==='brooks'&&!!u?.searchParams.has('size');}
