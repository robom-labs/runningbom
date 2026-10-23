import {load} from 'cheerio';
// Read published page data, not private endpoints. Never confuse the default
// recommendation order or review score with popularity.
export function interestFromPage(html,url){
 const $=load(html);const data=JSON.parse($('script#__NUXT_DATA__').text()||'[]');
 if(!Array.isArray(data))throw new Error('source format changed');
 const rows=[];for(const node of data){
  if(!node||typeof node!=='object'||Array.isArray(node)||!('product_id'in node)||!('views'in node))continue;
  const name=data[node.name],slug=data[node.slug],views=data[node.views];
  if(typeof name!=='string'||typeof slug!=='string'||!/^[-a-z0-9]+$/.test(slug)||!Number.isSafeInteger(views)||views<1)continue;
  rows.push({name,views,url:'https://runrepeat.com/'+slug,sourcePage:url});
 }
 if(!rows.length)throw new Error('no measured interest records');
 const next=[...new Set($('a[href]').map((_,e)=>$(e).attr('href')).get())].filter(h=>{try{const u=new URL(h,url);return u.origin==='https://runrepeat.com'&&u.pathname==='/catalog/running-shoes'&&/^\?page=\d+$/.test(u.search);}catch{return false;}}).map(h=>new URL(h,url).href);
 return {rows,next};
}
export const modelKey=name=>name.normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
export function mapInterest(products,records){
 const unique=new Map();for(const r of records){const key=modelKey(r.name);if(!unique.has(key)||r.views>unique.get(key).views)unique.set(key,r);}
 const keys=p=>[p.modelEn,p.model,p.name,...(p.aliases||[])].filter(Boolean).flatMap(n=>[modelKey(n),modelKey(p.brand+' '+n)]);
 const matches=products.flatMap(p=>{const r=keys(p).map(k=>unique.get(k)).find(Boolean);return r?[{item_id:p.id,model:r.name,value:r.views,evidenceUrl:r.url,sourcePage:r.sourcePage}]:[];});
 const ranked=[...unique.values()].filter(r=>matches.some(p=>p.model===r.name)).sort((a,b)=>b.views-a.views||a.name.localeCompare(b.name));
 const ranks=new Map(ranked.map((r,i)=>[r.name,i+1]));
 return matches.map(m=>({...m,rank:ranks.get(m.model)}));
}
