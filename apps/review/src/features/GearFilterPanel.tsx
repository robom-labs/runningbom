import {Check} from '@phosphor-icons/react';
export type GearFilterField='gearBrand'|'gearBudget'|'gearSort'|'gearTraining';
export const priceOptions=['전체','10만원 이하','10~20만원','20~30만원','30만원 초과'];
export const sortOptions=['기본순','낮은 가격순','높은 가격순','신제품순'];
export default function GearFilterPanel({field,value,brands,trainingUses,onSelect}:{field:GearFilterField;value:string;brands:string[];trainingUses:string[];onSelect:(value:string)=>void}){
 const options=field==='gearBrand'?['전체',...brands]:field==='gearBudget'?priceOptions:field==='gearTraining'?trainingUses:sortOptions;
 const labels:Record<string,string>={'전체':field==='gearBrand'?'모든 브랜드':field==='gearTraining'?'모든 훈련':'모든 가격','기본순':'기본 정렬'};
 const notes:Record<string,string>={'기본순':'전체 모델 둘러보기','낮은 가격순':'국내 원화 가격부터 비교','높은 가격순':'국내 원화 가격부터 비교','신제품순':'공개된 모델 출시일 기준','최근 확인순':'제품 정보를 수집한 날짜 기준'};
 const trainingNotes:Record<string,string>={'전체':'훈련 용도 전체','조깅':'편안하게 가볍게','회복런':'느린 회복 달리기','롱런':'오래, 길게 달리기','템포런':'빠른 페이스 유지','인터벌':'빠르게, 쉬기 반복','레이스':'대회 기록에 도전','트레일':'산길과 흙길'};
 return <div className="gear-filter-panel"><p>{field==='gearBrand'?'찾고 싶은 브랜드를 골라주세요.':field==='gearBudget'?'국내 원화 가격으로 골라요.':field==='gearTraining'?'주로 어떤 훈련에 신을까요?':'보고 싶은 순서로 정리해요.'}</p>
  <div className={field==='gearSort'?'filter-options filter-sort-options':'filter-options'} role="group" aria-label={field==='gearBrand'?'브랜드 선택':field==='gearBudget'?'가격대 선택':field==='gearTraining'?'훈련 용도 선택':'정렬 선택'}>
   {options.map(option=><button key={option} className={value===option?'filter-option selected':'filter-option'} aria-pressed={value===option} onClick={()=>onSelect(option)}><span><strong>{labels[option]||option}</strong>{field==='gearSort'&&<small>{notes[option]}</small>}{field==='gearTraining'&&<small>{trainingNotes[option]}</small>}</span><Check size={19} weight="bold" className={value===option?'selection-check':'selection-check hidden'}/></button>)}
  </div>
 </div>;
}
