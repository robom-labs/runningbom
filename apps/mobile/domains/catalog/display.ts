// One display policy for the native app and review UI, including older cached snapshots.
// Missing source facts produce no label, row or placeholder.
const unavailable = /미확인|미공개|미정|확인\s*중|확인\s*필요|안내\s*없|안내하지\s*않|안내되지|공식.*(?:사이즈|사양).*확인|색상명.*공개|컬러명.*공개/;
export function knownText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.split(/\s+·\s+/).map(part => part.trim()).filter(part => part && !unavailable.test(part)).join(' · ');
}
export function knownFacts(rows: (readonly [string, unknown])[]): string[][] {
  return rows.flatMap(([label,value]) => {const text=knownText(value);return text?[[label,text]]:[];});
}
export const shortPurposes: Record<string,string> = {
  '입문·매일 러닝':'데일리', '푹신한 쿠션':'쿠션', '탄탄한 지지':'안정화',
  '빠른 훈련':'스피드', '슈퍼 트레이너':'슈퍼트레이너', '대회용 카본':'카본',
  '트레일':'트레일', '분류 확인 중':'',
};
export const shortPurpose = (value:string) => shortPurposes[value] ?? knownText(value);
const trainingNames:Record<string,string>={daily:'조깅',recovery:'회복런',long:'롱런',tempo:'템포런',interval:'인터벌',race:'레이스',trail:'트레일'};
export const trainingText=(uses:string[])=>uses.map(use=>trainingNames[use]).filter(Boolean).join(' · ');
export function releaseLabel(release:string):string {
  if (!/^20\d{2}-\d{2}(?:-\d{2})?$/.test(release)) return '';
  const [year,month,day]=release.split('-');
  return `${year}년 ${Number(month)}월${day?` ${Number(day)}일`:''}`;
}
export function isRecentRelease(release:string,upcoming:boolean,now=new Date()):boolean {
  if(!release||upcoming)return false;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(now);
  const cutoff=`${Number(today.slice(0,4))-1}${today.slice(4)}`;
  return release>=cutoff&&release<=today;
}
