import {useEffect,useState} from 'react';
import {Modal,SafeAreaView,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Button,Card} from '../../design-system/components';
import {palette} from '../../design-system/theme';
import {memberClient,ownProfile} from '../../../services/supabase/members';
import {MemberAccountNative} from '../community/MemberScreen';
type Identity={nickname?:string;handle?:string;email:string;joined:string};
export function PersonalHub(){
 const [identity,setIdentity]=useState<Identity|null>(null),[show,setShow]=useState(false),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 useEffect(()=>{let active=true;let timer:ReturnType<typeof setTimeout>|undefined;
  async function load(){if(!memberClient){setLoading(false);return;}try{const {data:{user}}=await memberClient.auth.getUser();if(!active)return;if(!user){setIdentity(null);return;}const profile=await ownProfile();if(active)setIdentity({...profile,email:user.email||'',joined:user.created_at});}catch{/* Existing local running records remain available. */}finally{if(active)setLoading(false);}}
  void load();const sub=memberClient?.auth.onAuthStateChange(()=>{clearTimeout(timer);timer=setTimeout(()=>void load(),0);});return()=>{active=false;clearTimeout(timer);sub?.data.subscription.unsubscribe();};
 },[revision]);
 return <><Card><View style={s.heading}><View style={s.avatar}><Text style={s.initial}>{identity?.nickname?.slice(0,1)||'R'}</Text></View><View style={s.copy}><Text style={s.eyebrow}>MY RUNNINGBOM</Text><Text style={s.title}>{loading?'내 정보를 확인하고 있어요':identity?.nickname||'나의 러닝, 여기서부터'}</Text><Text style={s.note}>{identity?(identity.handle?'@'+identity.handle:'아이디를 설정해 주세요'):'로그인하면 내 아이디와 계정을 관리할 수 있어요.'}</Text></View></View>{identity&&<View style={s.facts}><Text style={s.note}>내 이메일 · 나만 보기</Text><Text style={s.body}>{identity.email||'이메일 미등록'}</Text><Text style={s.note}>가입일 · {new Date(identity.joined).toLocaleDateString('ko-KR')}</Text></View>}<Button label={identity?'내 정보·계정 관리':'로그인 · 내 아이디 만들기'} onPress={()=>setShow(true)} tone="secondary"/><Text style={s.note}>이메일·계정 설정은 내 화면에서만 보여요.</Text></Card><Modal visible={show} animationType="slide" onRequestClose={()=>setShow(false)}><SafeAreaView style={s.modal}><Button label="내 정보 닫기" tone="quiet" onPress={()=>{setShow(false);setRevision(n=>n+1);}}/><ScrollView contentContainerStyle={s.account} keyboardShouldPersistTaps="handled"><MemberAccountNative onDone={()=>{setShow(false);setRevision(n=>n+1);}}/></ScrollView></SafeAreaView></Modal></>;
}
const s=StyleSheet.create({heading:{flexDirection:'row',gap:12,alignItems:'center'},avatar:{width:54,height:54,borderRadius:18,backgroundColor:'#E0EFE5',alignItems:'center',justifyContent:'center'},initial:{fontSize:24,fontWeight:'800',color:palette.accentStrong},copy:{flex:1},eyebrow:{fontSize:10,color:palette.accentStrong,letterSpacing:1},title:{fontSize:19,lineHeight:27,fontWeight:'800',color:palette.ink},note:{fontSize:12,lineHeight:20,color:palette.muted,marginVertical:5},body:{fontSize:14,lineHeight:22,color:palette.ink},facts:{marginVertical:12},modal:{flex:1,backgroundColor:palette.canvas},account:{padding:20,gap:12}});
