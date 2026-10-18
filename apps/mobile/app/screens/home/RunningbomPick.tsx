import {useEffect,useState} from 'react';import {Image,Linking,Pressable,StyleSheet,Text,View} from 'react-native';
import {palette} from '../../design-system/theme';
import {supabase} from '../../../services/supabase/client';
import {useVerifiedCatalog} from '../../../domains/catalog/useVerifiedCatalog';
import {catalogImages} from '../../../domains/catalog/catalogImages';
type Campaign={id:string;label:'광고'|'제휴 광고';title:string;body:string;product_id:string|null;landing_url:string;starts_at:string;ends_at:string};
export function RunningbomPick({onOpenGear}:{onOpenGear:()=>void}){
 const {products}=useVerifiedCatalog();const [campaign,setCampaign]=useState<Campaign|null>(null);
 useEffect(()=>{let alive=true;async function load(){if(!supabase)return;const {data,error}=await supabase.from('ad_campaigns').select('id,label,title,body,product_id,landing_url,starts_at,ends_at').eq('placement','home-pick').order('starts_at',{ascending:false}).limit(1);const c=data?.[0];if(!alive)return;setCampaign(!error&&c&&['광고','제휴 광고'].includes(c.label)&&c.landing_url.startsWith('https://')&&Date.parse(c.starts_at)<=Date.now()&&Date.parse(c.ends_at)>Date.now()?c:null);}void load();const timer=setInterval(()=>void load(),60000);return()=>{alive=false;clearInterval(timer);};},[]);
 const live=campaign&&Date.parse(campaign.ends_at)>Date.now()?campaign:null;
 const p=live?products.find(p=>p.id===live.product_id):products[0];if(!live&&!p)return null;
 return <Pressable accessibilityRole="button" accessibilityLabel={live?`${live.label}, ${live.title}`:'러닝봄 PICK, 에디터 추천 러닝화 보기'} onPress={()=>{if(live)void Linking.openURL(live.landing_url);else onOpenGear();}} style={s.card}>
  <View style={s.copy}><Text style={s.label}>러닝봄 PICK · {live?.label||'에디터 추천'}</Text><Text style={s.title}>{live?.title||'나에게 맞는 한 켤레'}</Text><Text style={s.body}>{live?.body||'입문부터 레이스까지, 용도별로 가볍게 찾아봐요.'}</Text></View>
  {p&&<Image resizeMode="contain" accessibilityLabel={`${p.brand} ${p.model} 실제 제품 사진`} source={catalogImages[p.id]?.sha256===p.imageSha256?catalogImages[p.id].source:{uri:p.imageSource}} style={s.image}/>}
 </Pressable>;
}
const s=StyleSheet.create({card:{backgroundColor:'#EDF5F0',borderRadius:18,padding:18,flexDirection:'row',alignItems:'center',gap:8,minHeight:160},copy:{flex:1,gap:9},label:{fontSize:11,color:palette.accentStrong,fontWeight:'700'},title:{fontSize:19,lineHeight:27,fontWeight:'800',color:palette.ink},body:{fontSize:13,lineHeight:21,color:palette.inkSoft},image:{width:120,height:125}});
