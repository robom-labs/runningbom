export type FilterProduct = {id:string;brand:string;name:string;model:string;modelEn?:string;aliases?:string[];sku:string|null;purpose:string;uses:string[];price:number|null;currency:string;release:string;upcoming:boolean;checkedAt:string};
import {isRecentRelease} from './verified-content';
export type ProductFilters = {purpose:string;brand:string;budget:string;query:string;view:string;sort:string;use:string;favorites:string[]};
const aliases: Record<string,string> = {nike:"나이키",asics:"아식스",adidas:"아디다스",hoka:"호카",brooks:"브룩스","new balance":"뉴발란스 뉴발",saucony:"써코니 사코니",on:"온러닝",altra:"알트라","topo athletic":"토포",puma:"푸마",mizuno:"미즈노",salomon:"살로몬",kiprun:"킵런 데카트론",karhu:"카르후"};
const normalize = (text:string) => text.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[\s·™®-]/g,"");
export function filterProducts<T extends FilterProduct>(products:T[], filters:ProductFilters,now=new Date()):T[] {
  const q=normalize(filters.query);
  const exactBrand=q?Object.entries(aliases).find(([brand,words])=>[brand,...words.split(' ')].some(word=>normalize(word)===q))?.[0]:undefined;
  return products.filter(p=>{
    if(filters.purpose!=="전체" && p.purpose!==filters.purpose)return false;
    if(filters.brand!=="전체" && p.brand!==filters.brand)return false;
    if(filters.use!=="전체" && !p.uses.includes(filters.use))return false;
    if(filters.view==="출시 예정" && !p.upcoming)return false;
    if(filters.view==="관심" && !filters.favorites.includes(p.id))return false;
    if(filters.view==="최신" && !isRecentRelease(p.release,p.upcoming,now))return false;
    if(filters.budget==="가격 미정") {if(p.price!==null)return false;}
    else if(filters.budget!=="전체") {
      if(p.currency!=="KRW" || p.price===null)return false;
      if(filters.budget==="10만원 이하" && p.price>100000)return false;
      if(filters.budget==="10~20만원" && (p.price<=100000 || p.price>200000))return false;
      if(filters.budget==="20~30만원" && (p.price<=200000 || p.price>300000))return false;
      if(filters.budget==="30만원 초과" && p.price<=300000)return false;
    }
    if(exactBrand)return p.brand.toLowerCase()===exactBrand;
    const localNames=(aliases[p.brand.toLowerCase()]||'').split(' ').map(a=>a+p.name);
    return !q || normalize([p.brand,p.name,p.modelEn,p.sku,...(p.aliases??[]),aliases[p.brand.toLowerCase()],...localNames].join(" ")).includes(q);
  }).sort((a,b)=>{
    if(filters.sort.includes("가격")) {
      const ak=a.currency==="KRW"&&a.price!==null;const bk=b.currency==="KRW"&&b.price!==null;
      if(ak!==bk)return ak?-1:1;
      if(!ak||!bk)return a.brand.localeCompare(b.brand);
      return filters.sort==="낮은 가격순" ? a.price!-b.price! : b.price!-a.price!;
    }
    if(filters.view==="출시 예정")return a.release.localeCompare(b.release);
    if(filters.sort==="신제품순" || filters.view==="최신")return b.release.localeCompare(a.release)||b.checkedAt.localeCompare(a.checkedAt);
    if(filters.sort==="최근 확인순")return b.checkedAt.localeCompare(a.checkedAt);
    return 0;
  });
}
