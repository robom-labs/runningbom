import CommunityFeed from './CommunityFeed';
import {useEffect,useState} from 'react';
import type {Session,Provider} from '@supabase/supabase-js';
import {UserCircle,ArrowRight} from '@phosphor-icons/react';
import {KeyboardInput,useKeyboard} from '../mobile';
import {memberClient,socialProviders,friendlyMemberError,ownProfile,claimProfile} from '../integrations/members';
export function MemberAccount({onDone}:{onDone?:()=>void}){
 const [mode,setMode]=useState<'login'|'signup'|'profile'|'forgot'|'reset'>(new URLSearchParams(window.location.search).get('flow')==='recovery'?'reset':'login');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[handle,setHandle]=useState(''),[nickname,setNickname]=useState('');
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[session,setSession]=useState<Session|null>(null);
 const [consent,setConsent]=useState(false);
 const [claimedHandle,setClaimedHandle]=useState('');
 const keyboard=useKeyboard();
 useEffect(()=>{if(!memberClient)return;void memberClient.auth.getSession().then(({data})=>setSession(data.session));const {data}=memberClient.auth.onAuthStateChange((event,s)=>{setSession(s);if(event==='PASSWORD_RECOVERY')setMode('reset');});return()=>data.subscription.unsubscribe();},[]);
 useEffect(()=>{let active=true;if(!session){setClaimedHandle('');return;}void ownProfile().then(p=>{if(!active)return;setClaimedHandle(p?.handle||'');setHandle(p?.handle||String(session.user.user_metadata?.handle||''));setNickname(p?.nickname||String(session.user.user_metadata?.nickname||''));if(!p?.handle)setMode(current=>current==='reset'?'reset':'profile');}).catch(e=>{if(active)setMessage(friendlyMemberError(e));});return()=>{active=false;};},[session?.user.id]);
 async function submit(){
  if(!memberClient)return;keyboard.hide();setBusy(true);setMessage('');
  try{
   if((mode==='signup'||mode==='profile')&&!consent)throw new Error('소통 이용 규칙을 확인해 주세요.');
   if(mode==='reset'){const {error}=await memberClient.auth.updateUser({password});if(error)throw error;setMessage('비밀번호를 바꿨어요.');window.history.replaceState({},'',window.location.pathname);setMode('login');}
   else if(mode==='profile'){await claimProfile(handle,nickname);setMessage('아이디와 닉네임을 저장했어요.');onDone?.();}
   else if(mode==='forgot'){const {error}=await memberClient.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+'/?flow=recovery'});if(error)throw error;setMessage('등록된 이메일이라면 비밀번호 재설정 안내를 보냈어요.');}
   else if(mode==='signup'){
    if(nickname.trim().length<2||nickname.trim().length>16)throw new Error('닉네임은 2~16자로 정해 주세요.');
    if(!/^[a-z][a-z0-9_]{2,19}$/.test(handle))throw new Error('아이디는 영문 소문자로 시작하는 3~20자예요. 숫자와 _도 쓸 수 있어요.');
    const {data,error}=await memberClient.auth.signUp({email,password,options:{data:{nickname,handle},emailRedirectTo:window.location.origin}});if(error)throw error;
    if(data.session){await claimProfile(handle,nickname);onDone?.();}else setMessage('확인 메일을 보냈어요. 링크를 누른 뒤 로그인해 주세요.');
   }else{const {error}=await memberClient.auth.signInWithPassword({email,password});if(error)throw error;const p=await ownProfile();if(!p?.handle){setMode('profile');setMessage('소통에서 쓸 아이디와 닉네임을 골라 주세요.');}else onDone?.();}
   setPassword('');
  }catch(e){setMessage(friendlyMemberError(e));}finally{setBusy(false);}
 }
 return <div className="member-account"><div className="member-symbol"><UserCircle size={30}/></div><h3>{mode==='signup'?'같이 달릴 준비, 끝.':mode==='profile'?'어떤 이름으로 불러드릴까요?':mode==='forgot'?'비밀번호 다시 찾기':mode==='reset'?'새 비밀번호 정하기':'나의 러닝봄으로 로그인'}</h3><p>대회와 신발은 편하게 둘러보고,<br/>이야기와 대화는 내 계정으로 남겨요.</p>
 {!memberClient&&<div className="member-notice"><strong>회원 서버 연결 준비 중</strong><span>현재 미리보기에서는 계정을 만들거나 메시지를 전송하지 않아요. 대회와 러닝화는 바로 둘러볼 수 있어요.</span></div>}
 {session&&mode!=='profile'&&mode!=='reset'?<><div className="member-notice">로그인되어 있어요. 계정 아이디와 닉네임을 설정할 수 있어요.</div><button className="secondary wide" onClick={()=>setMode('profile')}>아이디·닉네임 설정</button><button className="quiet-button" onClick={async()=>{const {error}=await memberClient!.auth.signOut();if(error)setMessage(friendlyMemberError(error));}}>로그아웃</button></>:<>
 {mode==='login'&&<div className="social-logins">{socialProviders.map(p=><button key={p.id} disabled={!memberClient||!p.enabled||busy} onClick={async()=>{keyboard.hide();const {error}=await memberClient!.auth.signInWithOAuth({provider:p.id as Provider,options:{redirectTo:window.location.origin}});if(error)setMessage(friendlyMemberError(error));}}>{p.label}로 계속하기{!p.enabled&&<small>연결 준비</small>}<ArrowRight size={16}/></button>)}</div>}
 {mode!=='profile'&&mode!=='reset'&&<label className="member-field">이메일<KeyboardInput autoComplete="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="runner@example.com"/></label>}
 {(mode==='login'||mode==='signup'||mode==='reset')&&<label className="member-field">비밀번호<KeyboardInput autoComplete={mode==='signup'||mode==='reset'?'new-password':'current-password'} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="8자 이상"/></label>}
 {(mode==='signup'||mode==='profile')&&<><label className="member-field">아이디<KeyboardInput value={handle} readOnly={!!claimedHandle} aria-readonly={!!claimedHandle} onChange={e=>setHandle(e.target.value)} maxLength={20} placeholder="예: morning_runner"/></label><label className="member-field">닉네임<KeyboardInput value={nickname} onChange={e=>setNickname(e.target.value)} maxLength={16} placeholder="예: 아침을 달리는 지수"/></label><p className="member-small">아이디는 @아이디로 보여요. 처음 정한 아이디는 유지하고, 닉네임은 바꿀 수 있어요. 로그인은 이메일 또는 연결한 계정으로 해요.</p></>}
 {(mode==='signup'||mode==='profile')&&<div className="member-notice"><p>모욕·혐오·불법 콘텐츠, 개인정보 노출과 반복 광고·도배는 금지해요. 신고·차단과 임시 가림을 운영해요.</p><label className="choice"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>소통 이용 규칙에 동의해요</span></label></div>}
 <button className="primary wide" disabled={!memberClient||busy||((mode==='login'||mode==='signup'||mode==='reset')&&password.length<8)} onClick={()=>void submit()}>{busy?'연결 중…':mode==='profile'?'내 이름 저장':mode==='reset'?'새 비밀번호 저장':mode==='signup'?'이메일로 가입':mode==='forgot'?'재설정 안내 받기':'이메일로 로그인'}</button>
 <button className="quiet-button" onClick={()=>{keyboard.hide();setMessage('');setMode(mode==='login'?'signup':'login');}}>{mode==='login'?'처음이에요 · 회원가입':'로그인으로 돌아가기'}</button>{mode==='login'&&<button className="quiet-button" onClick={()=>setMode('forgot')}>비밀번호를 잊었어요</button>}
 </>}{message&&<p role="status" className="member-feedback">{message}</p>}<div className="member-policy"><a href="https://robom.kr/privacy/runningbom" target="_blank" rel="noreferrer">개인정보 안내</a><a href="https://robom.kr/support" target="_blank" rel="noreferrer">문의하기</a></div></div>;
}
export default function MemberHub(){return <CommunityFeed renderAccount={onDone=><MemberAccount onDone={onDone}/>}/>;}
