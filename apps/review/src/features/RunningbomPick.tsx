import {useEffect,useState} from 'react';
import {CaretRight} from '@phosphor-icons/react';
import {memberClient} from '../integrations/members';
import type {Shoe} from './catalog';
type Campaign={id:string;label:string;title:string;body:string;product_id:string|null;landing_url:string;starts_at:string;ends_at:string};
export default function RunningbomPick({shoes,onBrowse}:{shoes:Shoe[];onBrowse:()=>void}){
 const [campaign,setCampaign]=useState<Campaign|null>(null);
 useEffect(()=>{let active=true;async function load(){if(!memberClient)return;try{const {data,error}=await memberClient.from('ad_campaigns').select('id,label,title,body,product_id,landing_url,starts_at,ends_at').eq('placement','home-pick').order('starts_at',{ascending:false}).limit(1);const c=data?.[0];if(active)setCampaign(!error&&c&&['광고','제휴 광고'].includes(c.label)&&c.landing_url.startsWith('https://')&&Date.parse(c.starts_at)<=Date.now()&&Date.parse(c.ends_at)>Date.now()?c:null);}catch{if(active)setCampaign(null);}}void load();const timer=setInterval(()=>void load(),60000);return()=>{active=false;clearInterval(timer);};},[]);
 const live=campaign&&Date.parse(campaign.ends_at)>Date.now()?campaign:null;
 const product=live?shoes.find(s=>s.id===live.product_id):shoes[0];
 const contents=<>{product&&<img src={product.image} alt={`${product.brand} ${product.name} · ${product.color} 제품 사진`}/>}<span className="gear-banner-copy"><small>러닝봄 PICK · {live?.label||'에디터 추천'}</small><strong>{live?.title||'나에게 맞는 한 켤레'}</strong><span>{live?.body||'입문부터 레이스까지, 용도별로 가볍게 찾아봐요.'}</span></span><CaretRight className="banner-arrow" size={20}/></>;
 return live?<a className="gear-banner" href={live.landing_url} target="_blank" rel="sponsored noopener noreferrer">{contents}</a>:<button className="gear-banner" onClick={onBrowse}>{contents}</button>;
}
