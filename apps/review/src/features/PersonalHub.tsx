import {useEffect,useState} from 'react';
import {UserCircle,CaretRight,IdentificationCard,ShieldCheck} from '@phosphor-icons/react';
import {memberClient,ownProfile} from '../integrations/members';
import './personal-hub.css';
type Identity={nickname?:string;handle?:string;email:string;joined:string;verified:boolean};
// FitTrackee informed the account/activity/equipment hierarchy; no tracker code copied.
export default function PersonalHub({onAccount}:{onAccount:()=>void}){
 const [identity,setIdentity]=useState<Identity|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(false);
 useEffect(()=>{let active=true;let timer:ReturnType<typeof setTimeout>|undefined;
  async function load(){if(!memberClient){setLoading(false);return;}try{
   const {data:{user}}=await memberClient.auth.getUser();if(!active)return;
   if(!user){setIdentity(null);setError(false);return;}
   const profile=await ownProfile();if(active){setIdentity({...profile,email:user.email||'',joined:user.created_at,verified:!!user.email_confirmed_at});setError(false);}
  }catch{if(active)setError(true);}finally{if(active)setLoading(false);}}
  void load();const sub=memberClient?.auth.onAuthStateChange(()=>{clearTimeout(timer);timer=setTimeout(()=>void load(),0);});
  const refresh=()=>void load();window.addEventListener('focus',refresh);window.addEventListener('runningbom:profile-updated',refresh);
  return()=>{active=false;clearTimeout(timer);sub?.data.subscription.unsubscribe();window.removeEventListener('focus',refresh);window.removeEventListener('runningbom:profile-updated',refresh);};
 },[]);
 return <section className="personal-hub" aria-label="내 프로필"><div className="personal-heading"><span className="personal-avatar"><UserCircle size={38}/></span><div><small>MY RUNNINGBOM</small><h2>{loading?'내 정보를 확인하고 있어요':identity?.nickname||'나의 러닝, 여기서부터'}</h2><p>{identity?(identity.handle?'@'+identity.handle:'아이디를 설정해 주세요'):'로그인하면 내 아이디와 계정을 관리할 수 있어요.'}</p></div></div>
  <button className="personal-account-link" onClick={onAccount}><IdentificationCard size={20}/><span>{identity?'내 정보·계정 관리':'로그인 · 내 아이디 만들기'}</span><CaretRight size={17}/></button>
  {identity&&<dl className="personal-facts"><div><dt>내 이메일 · 나만 보기</dt><dd>{identity.email||'이메일 미등록'}</dd></div><div><dt>가입일</dt><dd>{new Date(identity.joined).toLocaleDateString('ko-KR')}</dd></div><div><dt>이메일 확인</dt><dd>{identity.verified?'확인 완료':'확인 필요'}</dd></div></dl>}
  {error&&<p role="status">계정 정보를 다시 확인해 주세요. 저장한 일정은 계속 볼 수 있어요.</p>}<p className="personal-privacy"><ShieldCheck size={14}/>이메일과 계정 설정은 내 화면에서만 보여요.</p></section>;
}
