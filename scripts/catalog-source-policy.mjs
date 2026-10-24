// Narrow, observed official aliases. This is NOT a wildcard/subdomain allowlist.
// 2026-10-24: official ASICS JSON-LD uses www; official Brooks variants omit www.
const productAliases={'asics-1':['www.asics.co.kr'],'brooks-14':['brooksrunning.com.au']};
// PROPOSED 2026-10-24: eight bounded official-page reads, 86 declarations.
// Source-specific first-party Shopify files only, not whole-host permission.
const officialImageFileHosts={'altra-6':'www.altrarunning.com','karhu-9':'us.karhu.com','kiprun-10':'www.decathlon.com','salomon-13':'salomon.co.kr'};
export function resolveDeclaredCatalogUrl(value,pageUrl) {
  if(typeof value!=='string'||!value.trim())return null;
  try{const u=new URL(value,pageUrl);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')?u.href:null;}catch{return null;}
}
export function approvedCatalogUrl(value,source,{image=false,pageUrl}={}) {
  const resolved=resolveDeclaredCatalogUrl(value,pageUrl);if(!resolved)return false;
  const url=new URL(resolved),hosts=image?source.imageHosts:source.hosts;
  if(hosts?.includes(url.hostname))return true;
  if(!image)return (productAliases[source.id]??[]).includes(url.hostname);
  // Exact path actually declared by the approved Topo page; no arbitrary CDN host.
  if(source.id==='topo-athletic-5'&&url.hostname==='topoathletic.com.au'&&url.pathname.startsWith('/cdn/shop/'))return true;
  return officialImageFileHosts[source.id]===url.hostname&&/^\/cdn\/shop\/files\/[^/]+\.(?:png|jpg)$/.test(url.pathname);
}
// Alias equivalence never crosses source ID, region, currency or market boundaries.
export function sameApprovedCatalogHost(a,b,source){
  if(!approvedCatalogUrl(a,source)||!approvedCatalogUrl(b,source))return false;
  const key=value=>{const host=new URL(value).hostname;return productAliases[source.id]&&[...(source.hosts??[]),...productAliases[source.id]].includes(host)?source.hosts[0]:host;};
  return key(a)===key(b);
}
