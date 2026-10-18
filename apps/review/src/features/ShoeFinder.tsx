import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/survey-core.fontless.css";
import { CaretRight, CheckCircle, ArrowLeft, Sneaker } from "@phosphor-icons/react";
import { KeyboardTextarea, useKeyboard } from "../mobile";
import { shoes, money, productPrice, type Shoe } from "./catalog";
import {knownText,shortPurpose} from './verified-content';
import { candidateFacts, candidateProducts, concerns, criteria, finderExamples, finderSchema, fitEvidenceGap, needsClinicalCheck, requestHints, type FinderAnswer } from "./finder";

export default function ShoeFinder({ products = shoes, onProduct, onBrowse }: { products?: Shoe[]; onProduct: (id: string) => void; onBrowse: () => void }) {
  const [step, setStep] = useState<"say" | "confirm" | "result">("say");
  const [request, setRequest] = useState("");
  const [answer, setAnswer] = useState<FinderAnswer | null>(null);
  const [survey] = useState(() => new Model(finderSchema));
  const latestOnComplete = useRef((data: Model) => {
    setAnswer({ concerns: data.getValue("concerns") || [], purpose: data.getValue("purpose") || "daily", budget: Number(data.getValue("budget")) || 0, discomfort: data.getValue("discomfort") });
    setStep("result");
  });
  const keyboard = useKeyboard();
  const contentRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const scroller = contentRef.current?.closest<HTMLElement>(".sheet-content");
    if (scroller) scroller.scrollTop = 0;
  }, [step]);
  useEffect(() => {
    const completed = (model: Model) => latestOnComplete.current(model);
    survey.onComplete.add(completed);
    return () => { survey.onComplete.remove(completed); };
  }, [survey]);

  function confirm(text: string) {
    keyboard.hide();
    survey.clear(false, true);
    survey.data = { concerns: requestHints(text), purpose: "daily", budget: 0 };
    setStep("confirm");
  }
  function edit() {
    keyboard.hide();
    survey.clear(false, true);
    survey.data = answer ?? {};
    setStep("confirm");
  }
  const candidates = answer ? candidateProducts(products, answer) : [];
  const medical = answer ? needsClinicalCheck(answer) : false;
  const gap = answer ? fitEvidenceGap(answer) : false;

  return <div className="detail-content shoe-finder" key={step} ref={contentRef}>
    <div className="finder-progress" aria-label="신발 찾기 단계">
      {["내 이야기", "조건 확인", "결과 보기"].map((label, i) => <span key={label} className={i === ["say", "confirm", "result"].indexOf(step) ? "current" : ""}><b>{i + 1}</b>{label}</span>)}
    </div>
    {step === "say" && <>
      <span className="finder-mark"><Sneaker size={25} /></span>
      <h3>내 발 이야기부터 들려주세요.</h3>
      <p className="finder-lead">어려운 용어 없이, 평소 느끼는 그대로요.</p>
      <label className="finder-request-label" htmlFor="shoe-request">어떤 신발을 찾고 있나요?</label>
      <KeyboardTextarea id="shoe-request" className="finder-request" placeholder="예: 칼발이라 신발이 헐거워요. 가볍게 뛸 때 신을 걸 찾고 있어요." value={request} maxLength={500} onChange={e => setRequest(e.target.value)} />
      <p className="finder-small">이런 이야기부터 시작해도 좋아요.</p>
      <div className="finder-examples">{finderExamples.map(c => <button key={c.value} onClick={() => { setRequest(c.example); confirm(c.example); }}>{c.text}<CaretRight size={14} /></button>)}</div>
      <button className="primary wide" disabled={!request.trim()} onClick={() => confirm(request)}>내 말로 조건 정리하기<CaretRight size={17} /></button>
      <button className="quiet-button" onClick={() => confirm("")}>직접 골라볼게요</button>
      <p className="finder-privacy">입력한 이야기와 답은 이 창에서만 사용해요. 저장하거나 외부로 보내지 않아요.</p>
    </>}
    {step === "confirm" && <>
      <button className="finder-back" onClick={() => { keyboard.hide(); setStep("say"); }}><ArrowLeft size={15} />내 이야기 바꾸기</button>
      {request && <blockquote className="finder-quote">“{request}”</blockquote>}
      <p className="finder-lead">놓친 내용이 있으면 골라 주세요.<br />마지막에 용도와 가격도 함께 살펴볼게요.</p>
      <div className="finder-survey"><Survey model={survey} /></div>
    </>}
    {step === "result" && answer && <>
      <div className="finder-result-heading"><CheckCircle size={25} weight="duotone" /><h3>이렇게 찾아볼게요.</h3></div>
      <p className="finder-lead">{answer.concerns.map(c => concerns.find(item => item.value === c)?.short).filter(Boolean).join(" · ")}</p>
      <div className="finder-criteria">{answer.concerns.map(c => <section key={c}><h4>{criteria[c].title}</h4><p>{criteria[c].detail}</p></section>)}</div>
      {medical ? <div className="finder-notice"><h4>신발을 고르기 전에 확인해 주세요.</h4><p>이 정보만으로 통증에 맞는 모델을 정할 수는 없어요. 현재 상태에 맞는 쿠션·받침·깔창을 전문가와 확인한 뒤 신어 보고 골라 주세요.</p><p>지금은 질환별 추천 목록을 만들지 않고, 위의 선택 기준을 먼저 안내해요.</p></div> : <>
        {gap && <div className="finder-notice"><h4>용도와 가격으로 골랐어요.</h4><p>내 발에 맞는지는 위의 기준으로 직접 신어 보고 살펴보세요.</p></div>}
        <h4 className="finder-candidate-title">{gap ? "용도·가격으로 먼저 살펴볼 후보" : "특징으로 살펴볼 후보"}</h4>
        <p className="finder-small">{answer.budget ? `${money(answer.budget)}까지 · ` : ""}용도와 특징을 함께 살펴보세요.</p>
        {candidates.length ? <div className="finder-candidates">{candidates.map(p => <article key={p.id}><button className="finder-product" onClick={() => onProduct(p.id)}><img src={p.image} alt={`${p.brand} ${p.name} ${knownText(p.color)} 공식 원본 사진`} /><span><small>{p.brand} · {shortPurpose(p.purpose)}</small><strong>{p.name}</strong>{productPrice(p)&&<b>{productPrice(p)}</b>}</span><CaretRight size={16} /></button>{knownText(candidateFacts[p.id] || p.description)&&<p>{knownText(candidateFacts[p.id] || p.description)}</p>}</article>)}</div> : <div className="finder-notice"><h4>이 조건에 맞는 후보가 없어요.</h4><p>가격이나 용도를 바꿔 보세요.</p></div>}
      </>}
      <button className="secondary wide" onClick={edit}>내 조건 다시 고르기</button>
      <button className="quiet-button" onClick={() => { keyboard.hide(); onBrowse(); }}>전체 러닝화에서 직접 비교하기</button>
      <p className="finder-privacy">답은 저장하지 않아요.</p>
    </>}
  </div>;
}
