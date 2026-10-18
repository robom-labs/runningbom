export function emailAuthLinkKind(url:string,confirmationUrl:string,recoveryUrl:string):'confirm'|'recovery'|null{
 try{
  const parsed=new URL(url),base=parsed.href.split(/[?#]/)[0];
  if(parsed.username||parsed.password||!parsed.searchParams.get('code')||parsed.hash)return null;
  if(base===confirmationUrl)return 'confirm';
  if(base===recoveryUrl)return 'recovery';
 }catch{/* Unrelated or malformed app links are ignored. */}
 return null;
}
