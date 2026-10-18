import { lazy, Suspense, useEffect, useLayoutEffect, useState, type ReactNode, type CSSProperties } from "react";
import {
  Bell,
  CalendarBlank,
  CaretDown,
  CaretRight,
  Check,
  CheckCircle,
  ChatCircle,
  ChatCircleDots,
  DownloadSimple,
  Heart,
  House,
  Leaf,
  ListBullets,
  MagnifyingGlass,
  MapPin,
  Plus,
  Scales,
  ShareNetwork,
  ShieldCheck,
  Sneaker,
  Sparkle,
  User,
  X,
} from "@phosphor-icons/react";
import { createEvents } from "ics";
import "@fontsource/noto-sans-kr/korean-400.css";
import "@fontsource/noto-sans-kr/korean-500.css";
import "@fontsource/noto-sans-kr/korean-700.css";
import "@fontsource/noto-sans-kr/korean-900.css";
import {
  BottomSheet,
  Carousel,
  KeyboardInput,
  KeyboardTextarea,
  MobileScroll,
  useKeyboard,
  useKeyboardInsets,
  useMobileDevice,
  useScreenPortal,
} from "./mobile";
import {
  examplePosts,
  formatDate,
  money,
  productPrice,
  purposes,
  trainingUses,
  useCodes,
  type FeedPost,
  type Race,
} from "./features/catalog";
import { configuredCommunity, readCommunity } from "./integrations/nodebb";
import { fitFor } from "./features/fit";
import {knownText,knownFacts,shortPurpose,trainingText,releaseLabel} from './features/verified-content';
import { filterProducts } from "./features/product-filter";
import PersonalHub from './features/PersonalHub';
import {useLiveRaces} from "./features/live-races";
import { useLiveCatalog } from "./features/live-catalog";
import RunningbomPick from "./features/RunningbomPick";
import {raceFocus,registrationRank} from "./features/race-status";
const RaceCalendar=lazy(()=>import('./features/RaceCalendar'));
import GearFilterPanel from './features/GearFilterPanel';
import './features/discovery.css';
import './features/responsive.css';
import './features/race-media.css';
import {raceMediaLayout} from './features/race-media';
const MemberHub = lazy(() => import("./features/MemberHub"));
const MemberAccount = lazy(() => import("./features/MemberHub").then(m => ({default:m.MemberAccount})));
const ShoeFinder = lazy(() => import("./features/ShoeFinder"));

type Tab = "오늘" | "대회" | "장비" | "소통" | "내 일정";
type Modal =
  | { type: "race" | "alarm" | "shoe" | "post"; id: string }
  | {
      type:
        | "search"
        | "inbox"
        | "compare"
        | "shoeCompare"
        | "compose"
        | "premium"
        | "about"
        | "fit"
        | "account";
    }
  | {type:'gearBrand'|'gearBudget'|'gearSort'|'gearTraining'}
  | null;
type Reminder = { id: string; lead: string; changes: boolean;target?:'open'|'close'|'race' };
function useStored<T>(key: string, initial: T) {
  const [value, set] = useState<T>(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("runningbom:" + key) || "null") ??
        initial
      );
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("runningbom:" + key, JSON.stringify(value));
    } catch {
      /* Browsing remains available without storage. */
    }
  }, [key, value]);
  return [value, set] as const;
}

export default function Prototype() {
  const presentation=new URLSearchParams(window.location.search).get('display');
  const webPresentation=presentation==='web'||(!import.meta.env.DEV&&presentation!=='phone');
  const {races}=useLiveRaces();
  const featured=races.find(r=>r.image&&!r.imageKind?.includes('logo')&&r.status==='접수중')||races.find(r=>r.image&&r.status==='접수중')||races.find(r=>r.image)||races[0];
  const {shoes}=useLiveCatalog();
  const [tab, setTab] = useState<Tab>(new URLSearchParams(window.location.search).has('post')?'소통':'오늘');
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useStored<string[]>("races", []);
  const [alarms, setAlarms] = useStored<Reminder[]>("alarms", []);
  const [favorites, setFavorites] = useStored<string[]>("shoes", []);
  const [likes, setLikes] = useStored<string[]>("example-likes", []);
  const [checks, setChecks] = useStored<string[]>("checks", []);
  const [draft, setDraft] = useStored("draft", "");
  const [axis, setAxis] = useState("접수 일정");
  const [view, setView] = useState("목록");
  const [region, setRegion] = useStored("region", "전체");
  const [distance, setDistance] = useStored("distance", "전체");
  const [compare, setCompare] = useState<string[]>([]);
  const [shoeCompare, setShoeCompare] = useState<string[]>([]);
  const [purpose, setPurpose] = useState("전체");
  const [brand, setBrand] = useState("전체");
  const [budget, setBudget] = useState("전체");
  const [shoeSort, setShoeSort] = useState("기본순");
  const [shoeQuery, setShoeQuery] = useState("");
  const [trainingUse, setTrainingUse] = useState("전체");
  const [visibleShoes, setVisibleShoes] = useState(20);
  const [compareDetail, setCompareDetail] = useState(false);
  const [gearView, setGearView] = useState("전체");
  const [feedTag, setFeedTag] = useState("전체");
  const [lead, setLead] = useState("1일 전");
  const [alarmTarget,setAlarmTarget]=useState<'open'|'close'|'race'>('open');
  const [changes, setChanges] = useState(true);
  const [feed, setFeed] = useState<FeedPost[]>(examplePosts);
  const [feedState, setFeedState] = useState("example");
  const [feedError, setFeedError] = useState("");
  const [retry, setRetry] = useState(0);
  const { device } = useMobileDevice();
  const keyboard = useKeyboard();
  const { screenRef } = useScreenPortal();
  const { bottomInset, isKeyboardVisible, keyboardHeight } =
    useKeyboardInsets();
  useLayoutEffect(()=>{if(webPresentation)document.documentElement.dataset.rbPresentation='web';return()=>{delete document.documentElement.dataset.rbPresentation;};},[webPresentation]);
  // Native focus may scroll a clipped phone ancestor to reveal an input in
  // the simulated keyboard. Keep only app-owned scroll regions moving.
  useLayoutEffect(() => {
    if (screenRef.current) screenRef.current.scrollTop = 0;
    const frame = requestAnimationFrame(() => {
      if (screenRef.current) screenRef.current.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [screenRef, device.id, keyboard.focusedElement, isKeyboardVisible, modal, tab]);
  useLayoutEffect(() => {
    const keepFrameStill = () => {
      const screen=screenRef.current;
      if (screen&&(screen.scrollTop||screen.scrollLeft))screen.scrollTo({top:0,left:0,behavior:'instant'});
    };
    // Capture browser focus scrolling as well as the inner scroller; a transformed
    // phone viewport must never move its status bar, keyboard dock or app header.
    document.addEventListener('scroll',keepFrameStill,{passive:true,capture:true});
    const refocus=()=>requestAnimationFrame(keepFrameStill);
    document.addEventListener('focusin',refocus);
    keepFrameStill();
    return()=>{document.removeEventListener('scroll',keepFrameStill,true);document.removeEventListener('focusin',refocus);};
  }, [screenRef, device.id]);
  useEffect(() => {
    document.title = "러닝봄 · 다음 대회, 놓치지 않게";
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4800);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    let base;
    try {
      base = configuredCommunity();
    } catch (e) {
      setFeedError(String(e));
      setFeedState("error");
      return;
    }
    if (!base) return;
    const controller = new AbortController();
    setFeedState("loading");
    readCommunity(controller.signal)
      .then((posts) => {
        setFeed(posts);
        setFeedState("ready");
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") {
          setFeed([]);
          setFeedError(e.message);
          setFeedState("error");
        }
      });
    return () => controller.abort();
  }, [retry]);
  const open = (m: Modal) => {
    keyboard.hide();
    setModal(m);
  };
  const close = () => open(null);
  const nav = (t: Tab) => {
    close();
    setTab(t);
  };
  const toggle = (id: string, values: string[], set: (v: string[]) => void) =>
    set(values.includes(id) ? values.filter((v) => v !== id) : [...values, id]);
  const race =
    modal && "id" in modal ? races.find((r) => r.id === modal.id) : undefined;
  const shoe =
    modal && "id" in modal ? shoes.find((s) => s.id === modal.id) : undefined;
  const post =
    modal && "id" in modal ? feed.find((p) => p.id === modal.id) : undefined;
  const alarm = (id: string) => {
    const a = alarms.find((v) => v.id === id);
    const r=races.find(r=>r.id===id);const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
    const target=a?.target||(r?.opensAt&&r.opensAt.slice(0,10)>=today?'open':r?.closesAt&&r.closesAt.slice(0,10)>=today?'close':'race');
    setAlarmTarget(target);setLead(a?.lead&&a.lead!=='1일 전'?a.lead:"전날 오전 9시");
    setChanges(a?.changes ?? true);
    open({ type: "alarm", id });
  };
  const saveAlarm = () => {
    if (!race) return;
    setAlarms([
      ...alarms.filter((a) => a.id !== race.id),
      { id: race.id, lead, changes,target:alarmTarget },
    ]);
    if (!saved.includes(race.id)) setSaved([...saved, race.id]);
    close();
    setToast(
      "이 기기에 알림 조건을 저장했어요. 실제 발송은 서비스 연결 후 가능해요.",
    );
  };
  const row = (r: Race, compact = false) => (
    <RaceRow
      key={r.id}
      race={r}
      compact={compact}
      axis={axis}
      alarm={alarms.some((a) => a.id === r.id)}
      onOpen={() => open({ type: "race", id: r.id })}
      onAlarm={() => alarm(r.id)}
    />
  );
  const filtered = races
    .filter(
      (r) =>
        (region === "전체" || r.region === region) &&
        (distance === "전체" || r.distances.includes(distance)||(distance==='기타 거리'&&r.distances.some(d=>!['5km','10km','하프','풀'].includes(d)))),
    )
    .sort(
      (a, b) =>
        (Number(a.needsReview)-Number(b.needsReview))||
        (axis==='접수 일정'?(registrationRank(a.status)-registrationRank(b.status)):0)||
        (Date.parse(raceFocus(a,axis).date) || Infinity) - (Date.parse(raceFocus(b,axis).date) || Infinity),
    );
  const filteredShoes = filterProducts(shoes, {purpose, brand, budget, query:shoeQuery, view:gearView, sort:shoeSort, use:useCodes[trainingUse] || "전체", favorites});
  useEffect(() => setVisibleShoes(20), [purpose, brand, budget, shoeQuery, gearView, shoeSort, trainingUse]);
  const pickCompare = (
    id: string,
    ids: string[],
    set: (v: string[]) => void,
  ) => {
    if (ids.includes(id)) set(ids.filter((v) => v !== id));
    else if (ids.length < 3) set([...ids, id]);
    else setToast("비교는 최대 3개까지 담을 수 있어요.");
  };
  function exportCalendar() {
    const chosen = races.filter((r) => saved.includes(r.id));
    if (!chosen.length) {
      setToast("대회를 먼저 저장해 주세요.");
      return;
    }
    const events = chosen.flatMap(r=>[{title:`${r.name} 개최`,at:r.raceAt},...(r.opensAt?[{title:`${r.name} 접수 시작`,at:r.opensAt}]:[]),...(r.closesAt?[{title:`${r.name} 접수 마감`,at:r.closesAt}]:[])]).filter(e=>e.at).map(e=>{
      const d=new Date(e.at);const dateOnly=!e.at.includes("T");
      const start=dateOnly?[Number(e.at.slice(0,4)),Number(e.at.slice(5,7)),Number(e.at.slice(8,10))] as [number,number,number]:[d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),d.getUTCHours(),d.getUTCMinutes()] as [number,number,number,number,number];
      return {title:e.title,description:"러닝봄 출처 기반 일정. 시각 미공개 일정은 종일로 저장합니다. 신청 전 주최 측 안내를 확인하세요.",start,startInputType:"utc" as const,startOutputType:"utc" as const,duration:dateOnly?{days:1}:{minutes:30}};
    });
    const result = createEvents(events);
    if (!result.value || result.error) {
      setToast("파일을 만들지 못했어요.");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([result.value], { type: "text/calendar;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "러닝봄_관심일정.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast("관심 일정을 내려받았어요. 시각 미공개 일정은 종일로 표시돼요.");
  }
  const title =
    modal?.type === "race"
      ? race?.name
      : modal?.type === "shoe"
        ? shoe?.name
        : modal?.type === "alarm"
          ? "일정 알림 설정"
          : modal?.type === "search"
            ? "무엇을 찾고 있나요?"
            : modal?.type === "inbox"
              ? "알림함"
              : modal?.type === "compare"
                ? "대회 나란히 비교"
                : modal?.type === "shoeCompare"
                  ? "러닝화 나란히 비교"
                  : modal?.type === "post"
                    ? "러너의 이야기"
                    : modal?.type === "compose"
                      ? "이야기 작성"
                      : modal?.type === "premium"
                        ? "더 가벼워지는 대회 준비"
                        : modal?.type === "fit"
                          ? "내 이야기로 신발 찾기"
                          : modal?.type==='gearBrand'?'브랜드 선택':modal?.type==='gearBudget'?'가격대 선택':modal?.type==='gearSort'?'정렬 선택':modal?.type==='gearTraining'?'훈련 용도 선택':modal?.type==='account'?'내 계정':'러닝봄';
  return (
    <div
      className="running-app mobile-page"
      data-channel={tab}
      data-keyboard-visible={isKeyboardVisible ? "true" : "false"}
      style={
        {
          "--app-top": `${device.geometry.safeArea.top}px`,
          "--keyboard-height": `${keyboardHeight}px`,
        } as CSSProperties
      }
    >
      <header className="app-header">
        <button
          className="wordmark"
          aria-label="러닝봄 오늘로"
          onClick={() => nav("오늘")}
        >
          <span className="selected-brand" aria-hidden="true" />
        </button>
        {import.meta.env.DEV&&<a className="preview-label" href={webPresentation?'?display=phone':'?display=web'}>{webPresentation?'앱 미리보기':'전체 화면'}</a>}
        <div className="header-actions"><button className="icon-button" aria-label="내 계정 로그인" onClick={()=>open({type:"account"})}><User size={23}/></button>
          <button
            className="icon-button"
            aria-label="검색"
            onClick={() => {
              setSearch("");
              open({ type: "search" });
            }}
          >
            <MagnifyingGlass size={25} />
          </button>
          <button
            className="icon-button"
            aria-label="알림함 열기"
            onClick={() => open({ type: "inbox" })}
          >
            <Bell size={25} />
            {alarms.length > 0 && <span className="notification-dot" />}
          </button>
        </div>
      </header>
      <MobileScroll key={tab} className="app-body">
        {tab === "오늘" && (
          <main className="home-content">
            <div className="greeting">
              <p>{new Date().toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul",month:"long",day:"numeric",weekday:"long"})}</p>
              <h1>다음 대회, 놓치지 않게.</h1>
              <p>좋은 달리기의 시작, 러닝봄이 함께할게요.</p>
            </div>
            {featured&&<section className={'featured-race layout-'+raceMediaLayout(featured)}>
              <button className="featured-race-media" aria-label={featured.name+' 상세'} onClick={()=>open({type:'race',id:featured.id})}><RacePhoto race={featured}/></button>
              <div className="featured-race-content"><div className="featured-race-topline"><span className="badge">{featured.status==='접수중'?'접수 중':featured.status}</span>{featured.closesAt&&<small>접수 마감 {formatDate(featured.closesAt)}</small>}</div>
                <button className="featured-race-title" onClick={()=>open({type:'race',id:featured.id})}>{featured.name.replace(/^20\d{2}\s*/,'')}</button>
                <p className="featured-race-location">{[featured.region,featured.venue].filter(Boolean).join(' · ')}</p><p className="featured-race-distance">{featured.distances.join(' / ')}</p>
              </div><div className="featured-race-footer"><div><small>대회 개최</small><strong>{formatDate(featured.raceAt)}</strong></div><button onClick={()=>alarm(featured.id)}><Bell size={19}/>{alarms.some(a=>a.id===featured.id)?'알림 저장됨':'알림 설정'}<CaretRight size={17}/></button></div></section>}
            <section className="weekly">
              <Heading
                title="지금 확인할 대회"
                action="전체 보기"
                onClick={() => nav("대회")}
              />
              {races.filter(r=>r.id!==featured?.id && ['접수중','마감임박'].includes(r.status)).sort((a,b)=>(Date.parse(a.closesAt)||Infinity)-(Date.parse(b.closesAt)||Infinity)).slice(0,2).map((r) => row(r, true))}
            </section>
            <RunningbomPick shoes={shoes} onBrowse={() => nav("장비")}/>
            <section className="home-social">
              <Heading
                title="함께 나누는 달리기"
                action="소통 보기"
                onClick={() => nav("소통")}
              />
              <button
                className="conversation-teaser"
                onClick={() => nav("소통")}
              >
                <ChatCircleDots size={27} />
                <span>
                  <strong>첫 하프를 준비하고 있나요?</strong>
                  <small>경험과 질문을 나눠 보세요.</small>
                </span>
                <CaretRight size={18} />
              </button>
            </section>
            <Sample />
          </main>
        )}
        {tab === "대회" && (
          <main className={'page-content races-page '+(view==='달력'?'calendar-page':'')}>
            <PageTitle
              eyebrow="READY, SET, RUN"
              title="나의 다음 스타트라인"
              text="접수 날짜와 달리는 날짜, 헷갈리지 않게."
            />
            <Segment
              values={["접수 일정", "대회 일정"]}
              value={axis}
              onChange={setAxis}
            />
            <div className="filter-row">
              <label>
                지역
                <select
                  aria-label="대회 지역"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  {["전체", ...new Set(races.map(r=>r.region))].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                거리
                <select
                  aria-label="대회 거리"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                >
                  {["전체", "5km", "10km", "하프", "풀", "기타 거리"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <div className="view-toggle">
                <button
                  aria-label="목록 보기"
                  aria-pressed={view === "목록"}
                  onClick={() => setView("목록")}
                >
                  <ListBullets size={21} />
                  <span>목록</span>
                </button>
                <button
                  aria-label="달력 보기"
                  aria-pressed={view === "달력"}
                  onClick={() => setView("달력")}
                >
                  <CalendarBlank size={21} />
                  <span>달력</span>
                </button>
              </div>
            </div>
            {view==='목록'&&<div className="result-caption">
              <span>{filtered.length}개 대회 · 한국 시간</span>
            </div>}
            {view === "목록" ? (
              filtered.length ? (
                filtered.map((r) => (
                  <div className="race-list-item" key={r.id}>
                    {row(r)}
                    <div className="row-bottom">
                      <span>
                        {axis === "접수 일정"
                          ? "대회 " + formatDate(r.raceAt)
                          : "접수 " + formatDate(r.opensAt)}
                      </span>
                      <button
                        className={
                          compare.includes(r.id)
                            ? "text-check selected"
                            : "text-check"
                        }
                        aria-pressed={compare.includes(r.id)}
                        onClick={() => pickCompare(r.id, compare, setCompare)}
                      >
                        <Scales size={15} />
                        {compare.includes(r.id) ? "비교 담음" : "비교"}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <Empty
                  title="조건에 맞는 대회가 없어요"
                  text="지역이나 거리를 바꿔 보세요."
                />
              )
            ) : (
              <Suspense fallback={<p>달력을 불러오는 중이에요.</p>}><RaceCalendar races={filtered} axis={axis} renderEntry={entry=><RaceRow race={entry.race} axis={axis} focusOverride={{label:entry.label,date:entry.date}} alarm={alarms.some(a=>a.id===entry.race.id)} onOpen={()=>open({type:'race',id:entry.race.id})} onAlarm={()=>alarm(entry.race.id)}/>} /></Suspense>
            )}
          </main>
        )}
        {tab === "장비" && (
          <main className="page-content gear-page">
            <div className="gear-heading"><h1>러닝화</h1></div>
            <Segment
              values={["전체", "최신", "출시 예정", "관심"]}
              value={gearView}
              onChange={(value)=>{setGearView(value);setBrand('전체');setBudget('전체');setPurpose('전체');setTrainingUse('전체');setShoeQuery('');setShoeSort('기본순');setVisibleShoes(20);}}
            />
            <div className="gear-filter-triggers">
              <button aria-label={`브랜드 선택, ${brand}`} aria-expanded={modal?.type==='gearBrand'} className={brand!=='전체'?'filter-trigger applied':'filter-trigger'} onClick={()=>open({type:'gearBrand'})}><span><b>{brand==='전체'?'브랜드':brand==='New Balance'?'뉴발란스':brand==='Topo Athletic'?'토포':brand}</b><CaretDown size={15}/></span></button>
              <button aria-label={`가격대 선택, ${budget}`} aria-expanded={modal?.type==='gearBudget'} className={budget!=='전체'?'filter-trigger applied':'filter-trigger'} onClick={()=>open({type:'gearBudget'})}><span><b>{budget==='전체'?'가격':budget.replace('만원','만')}</b><CaretDown size={15}/></span></button>
              <button aria-label={`정렬 선택, ${shoeSort}`} aria-expanded={modal?.type==='gearSort'} className={shoeSort!=='기본순'?'filter-trigger applied':'filter-trigger'} onClick={()=>open({type:'gearSort'})}><span><b>{({'기본순':'정렬','낮은 가격순':'낮은가격','높은 가격순':'높은가격','신제품순':'신제품'} as Record<string,string>)[shoeSort]||shoeSort}</b><CaretDown size={15}/></span></button>
            </div>
            {(brand!=='전체'||budget!=='전체'||purpose!=='전체'||trainingUse!=='전체'||shoeQuery)&&<div className="active-filter-summary"><span>선택한 조건으로 보고 있어요.</span><button onClick={()=>{setBrand('전체');setBudget('전체');setPurpose('전체');setTrainingUse('전체');setShoeQuery('');}}>조건 초기화</button></div>}
            <Carousel ariaLabel="러닝화 종류" contentClassName="shoe-category-rail">{purposes.map(value=><button className="shoe-kind-tab" key={value} aria-pressed={purpose===value} onClick={()=>{setPurpose(value);if(value!=='전체'&&trainingUse!=='전체'&&!shoes.some(p=>p.purpose===value&&p.uses.includes(useCodes[trainingUse])))setTrainingUse('전체');}}>{shortPurpose(value)}</button>)}</Carousel>
            <div className="result-caption">
              <span>{filteredShoes.length}개 모델 · {new Set(filteredShoes.map(s=>s.brand)).size}개 브랜드</span>
              <button className={trainingUse!=='전체'?'training-trigger applied':'training-trigger'} aria-label={`훈련 용도 선택, ${trainingUse}`} aria-expanded={modal?.type==='gearTraining'} onClick={()=>open({type:'gearTraining'})}>훈련: {trainingUse}<CaretDown size={14}/></button>
            </div>
            <div className="shoe-grid">
              {filteredShoes.slice(0,visibleShoes).map((s) => (
                <article key={s.id} className="shoe-card">
                  <div className="shoe-photo">
                    <button
                      aria-label={`${s.name} 상세 보기`}
                      onClick={() => open({ type: "shoe", id: s.id })}
                    >
                      <ProductPhoto
                        src={s.image}
                        alt={`${s.brand} ${s.name}${s.sku&&knownText(s.color)?' · '+knownText(s.color):''} 제품 사진`}
                      />
                    </button>
                    <button
                      className="favorite-button"
                      aria-label={`${s.name} 관심 저장`}
                      aria-pressed={favorites.includes(s.id)}
                      onClick={() => toggle(s.id, favorites, setFavorites)}
                    >
                      <Heart
                        size={20}
                        weight={favorites.includes(s.id) ? "fill" : "regular"}
                      />
                    </button>
                    {s.upcoming && (
                      <span className="upcoming-label">출시 예정</span>
                    )}
                  </div>
                  <button
                    className="shoe-title"
                    onClick={() => open({ type: "shoe", id: s.id })}
                  >
                    <small>
                      {s.brand}{shortPurpose(s.purpose) && ` · ${shortPurpose(s.purpose)}`}
                    </small>
                    <strong>{s.name}</strong>
                  </button>
                  {productPrice(s) && <p>
                    {productPrice(s)}
                    {s.currency === "KRW" && s.price !== null && s.regularPrice !== null && s.regularPrice > s.price && (
                      <del>{money(s.regularPrice)}</del>
                    )}
                  </p>}
                  {s.release && <small className="product-release">{releaseLabel(s.release)}{s.upcoming?' 예정':''}</small>}
                  <button
                    className={
                      shoeCompare.includes(s.id)
                        ? "text-check selected"
                        : "text-check"
                    }
                    aria-pressed={shoeCompare.includes(s.id)}
                    onClick={() =>
                      pickCompare(s.id, shoeCompare, setShoeCompare)
                    }
                  >
                    <Plus size={14} />
                    {shoeCompare.includes(s.id) ? "비교 담음" : "비교에 담기"}
                  </button>
                </article>
              ))}
            </div>
            {filteredShoes.length > visibleShoes && <button className="secondary wide catalog-more" onClick={() => setVisibleShoes(n => n + 20)}>20개 더 보기 · {Math.min(visibleShoes,filteredShoes.length)}/{filteredShoes.length}</button>}
            {!filteredShoes.length && (
              <Empty
                title={
                  gearView === "출시 예정"
                    ? "확인된 출시 예정 모델을 기다리고 있어요"
                    : "조건에 맞는 러닝화가 없어요"
                }
                text={
                  gearView === "출시 예정"
                    ? "다른 러닝화도 함께 둘러보세요."
                    : "검색·브랜드·가격대·용도 조건을 바꿔 보세요."
                }
              >
                <button
                  className="secondary"
                  onClick={() => {
                    setBrand("전체");
                    setBudget("전체");
                    setPurpose("전체");
                    setTrainingUse("전체");
                    setShoeQuery("");
                  }}
                >
                  조건 모두 풀기
                </button>
              </Empty>
            )}
          </main>
        )}
        {tab === "소통" && <main className="page-content community-page"><Suspense fallback={<p>피드를 불러오는 중이에요.</p>}><MemberHub/></Suspense></main>}
        {tab === "내 일정" && (
          <main className="page-content">
            <PageTitle
              eyebrow="MY RUNNING JOURNEY"
              title="내 정보와 달리기를 한눈에"
              text="나의 프로필부터 대회, 장비, 알림까지."
            />
            <PersonalHub onAccount={()=>open({type:'account'})}/>
            <div className="my-summary">
              {[
                [saved.length, "관심 대회"],
                [alarms.length, "알림 조건"],
                [favorites.length, "관심 장비"],
              ].map(([n, t]) => (
                <div key={t}>
                  <strong>{n}</strong>
                  <span>{t}</span>
                </div>
              ))}
            </div>
            <Heading
              title="다가오는 내 대회"
              action="일정 내보내기"
              onClick={exportCalendar}
            />
            {saved.length ? (
              races
                .filter((r) => saved.includes(r.id))
                .map((r) => (
                  <div className="my-race" key={r.id}>
                    {row(r, true)}
                    <div className="row-bottom">
                      <span>대회 {formatDate(r.raceAt)}</span>
                      <button onClick={() => toggle(r.id, saved, setSaved)}>
                        저장 해제
                      </button>
                    </div>
                  </div>
                ))
            ) : (
              <Empty
                title="다음 스타트라인을 담아 보세요"
                text="관심 대회를 저장하면 함께 준비할 수 있어요."
              >
                <button className="secondary" onClick={() => nav("대회")}>
                  대회 둘러보기
                  <CaretRight size={17} />
                </button>
              </Empty>
            )}
            <section className="checklist">
              <Heading title="출발 전 체크리스트" />
              <p>기록증부터 배번호까지, 하나씩 가볍게.</p>
              {[
                "참가 자격·기록 제출 확인",
                "공식 접수처에서 신청 완료",
                "참가비 결제·환불 기한 확인",
                "배번호 수령·교통편 확인",
                "러닝화·보급식 준비",
              ].map((v) => (
                <label className="checklist-row" key={v}>
                  <input
                    type="checkbox"
                    checked={checks.includes(v)}
                    onChange={() => toggle(v, checks, setChecks)}
                  />
                  <span>{v}</span>
                </label>
              ))}
            </section>
            <button
              className="premium-banner"
              onClick={() => open({ type: "premium" })}
            >
              <Sparkle size={24} />
              <span>
                <strong>준비에 쓰는 시간은 줄이고.</strong>
                <small>나만의 브리핑과 고급 알림</small>
              </span>
              <CaretRight size={19} />
            </button>
            <Info text="관심·알림 조건·초안은 이 브라우저에 보관됩니다. 계정 동기화와 실제 알림 발송은 아직 연결되지 않았습니다." />
          </main>
        )}
      </MobileScroll>
      {(webPresentation||!isKeyboardVisible) && (
        <nav
          className="bottom-nav"
          style={{ bottom: bottomInset + 8 }}
          aria-label="주요 메뉴"
        >
          {(
            [
              { name: "오늘", icon: House },
              { name: "대회", icon: CalendarBlank },
              { name: "장비", icon: Sneaker },
              { name: "소통", icon: ChatCircleDots },
              { name: "내 일정", icon: User },
            ] as const
          ).map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={tab === name ? "nav-item active" : "nav-item"}
              aria-current={tab === name ? "page" : undefined}
              onClick={() => nav(name)}
            >
              <span className="nav-icon"><Icon size={24} weight={tab === name ? "fill" : "bold"} /></span>
              <span className="nav-label">{name}</span>
            </button>
          ))}
        </nav>
      )}
      {toast && (
        <div
          className="app-toast"
          style={{ bottom: bottomInset + 78 }}
          role="status"
        >
          <CheckCircle size={19} />
          <span>{toast}</span>
          <button aria-label="안내 닫기" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {!modal&&!isKeyboardVisible&&((tab==='장비'&&shoeCompare.length>0)||(tab==='대회'&&compare.length>0))&&<button className="floating-compare primary" style={{bottom:bottomInset+78}} disabled={(tab==='장비'?shoeCompare.length:compare.length)<2} onClick={()=>open({type:tab==='장비'?'shoeCompare':'compare'})}><Scales size={18}/>{(tab==='장비'?shoeCompare.length:compare.length)<2?'1개 담았어요 · 하나 더 골라주세요':`${tab==='장비'?shoeCompare.length:compare.length}개 나란히 비교`}</button>}
    <BottomSheet
        open={!!modal}
        onOpenChange={(v) => {
          if (!v) close();
        }}
        title={title || "상세 정보"}
        description={
          modal?.type === "search"
            ? "대회 이름, 지역, 러닝화 목적을 찾아보세요."
            : undefined
        }
        snap={isKeyboardVisible ? 0.72 : modal?.type === "search" ? 0.88 : modal?.type==='gearBrand'?0.78:modal?.type==='gearBudget'||modal?.type==='gearTraining'?0.52:modal?.type==='gearSort'?0.66:0.82}
      >
        <button className="sheet-close" aria-label="상세 닫기" onClick={close}>
          <X size={20} />
        </button>
        {(modal?.type==='gearBrand'||modal?.type==='gearBudget'||modal?.type==='gearSort'||modal?.type==='gearTraining')&&<GearFilterPanel field={modal.type} value={modal.type==='gearBrand'?brand:modal.type==='gearBudget'?budget:modal.type==='gearTraining'?trainingUse:shoeSort} brands={[...new Set(shoes.map(s=>s.brand))]} trainingUses={trainingUses} onSelect={value=>{if(modal.type==='gearBrand')setBrand(value);else if(modal.type==='gearBudget')setBudget(value);else if(modal.type==='gearTraining'){setTrainingUse(value);if(value!=='전체'&&purpose!=='전체'&&!shoes.some(p=>p.purpose===purpose&&p.uses.includes(useCodes[value])))setPurpose('전체');}else setShoeSort(value);close();}}/>}
        {modal?.type === "race" && race && (
          <div className="detail-content">
            <RacePhoto race={race} detail/>
            <div className="detail-tags">
              <span className="badge">{race.status}</span>
              <span>{race.distances.join(" / ")}</span>
            </div>
            <Facts
              values={[
                ["대회 개최", formatDate(race.raceAt, true)],
                ["접수 시작", formatDate(race.opensAt, true)],
                ["접수 마감", formatDate(race.closesAt, true)],
                ["접수 회차", race.round],
                ["장소", race.region + " · " + race.venue],
                ["참가비", race.price===null?'':money(race.price)],
                ["참가 조건", race.eligibility],
              ]}
            />
            <div className="two-actions">
              <button
                className="secondary"
                onClick={() => toggle(race.id, saved, setSaved)}
              >
                <Heart
                  size={18}
                  weight={saved.includes(race.id) ? "fill" : "regular"}
                />
                {saved.includes(race.id) ? "저장됨" : "관심 저장"}
              </button>
              <button className="primary" onClick={() => alarm(race.id)}>
                <Bell size={18} />
                접수 알림
              </button>
            </div>
            <button
              className="link-row"
              onClick={() => {
                setFeedTag("대회 이야기");
                nav("소통");
              }}
            >
              <ChatCircleDots size={19} />
              대회 이야기 나누기
              <CaretRight size={17} />
            </button>
            {race.registrationUrl&&<div className="race-source"><a className="primary" href={race.registrationUrl} target="_blank" rel="noreferrer">대회 접수하러 가기 ↗</a></div>}
          </div>
        )}
        {modal?.type === "alarm" && race && (
          <div className="detail-content">
            <div className="reminder-subject">
              <CalendarBlank size={25} />
              <span>
                <strong>{race.name}</strong>
                <small>{alarmTarget==='open'?'접수 시작':alarmTarget==='close'?'접수 마감':'대회 개최'} {formatDate(alarmTarget==='open'?race.opensAt:alarmTarget==='close'?race.closesAt:race.raceAt,true)}</small>
              </span>
            </div>
            <h3 className="field-title">어떤 일정을 챙겨드릴까요?</h3>
            <div className="choice-grid">{(['open','close','race'] as const).map(target=>{const at=target==='open'?race.opensAt:target==='close'?race.closesAt:race.raceAt;const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());return <button key={target} className={alarmTarget===target?'choice selected':'choice'} aria-pressed={alarmTarget===target} disabled={!at||at.slice(0,10)<today} onClick={()=>{setAlarmTarget(target);setLead('전날 오전 9시');}}>{target==='open'?'접수 시작':target==='close'?'접수 마감':'대회 전'}</button>;})}</div>
            <h3 className="field-title">언제 알려드릴까요?</h3>
            <div className="choice-grid">
              {(race.timeConfirmed&&alarmTarget!=='race'?["전날 오전 9시", "1시간 전", "10분 전", "해당 시각"]:["전날 오전 9시"]).map((v) => (
                <button
                  key={v}
                  className={lead === v ? "choice selected" : "choice"}
                  aria-pressed={lead === v}
                  onClick={() => setLead(v)}
                >
                  {v}
                  {lead === v && <Check size={16} />}
                </button>
              ))}
            </div>
            {!race.timeConfirmed&&<Info text="공식 시각이 공개되지 않아 날짜 기준으로 설정해요. 오전 9시는 선택한 알림 시각이며 접수 시작 시각을 뜻하지 않아요."/>}
            <label className="toggle-row">
              <span>
                <strong>일정 변경도 알려주세요</strong>
                <small>정정·추가접수·취소 등 중요한 변경</small>
              </span>
              <input
                type="checkbox"
                checked={changes}
                onChange={(e) => setChanges(e.target.checked)}
              />
            </label>
            <Info text="지금은 조건만 이 기기에 저장됩니다. 실제 푸시·이메일·예약 발송은 아직 활성화되지 않았습니다." />
            <button className="primary wide" onClick={saveAlarm}>
              <Bell size={18} />
              알림 조건 저장
            </button>
            {alarms.some((a) => a.id === race.id) && (
              <button
                className="quiet-button"
                onClick={() => {
                  setAlarms(alarms.filter((a) => a.id !== race.id));
                  close();
                  setToast("알림 조건을 해제했어요.");
                }}
              >
                알림 조건 해제
              </button>
            )}
          </div>
        )}
        {modal?.type === "shoe" && shoe && (
          <div className="detail-content">
            <div className="detail-shoe">
              <ProductPhoto
                src={shoe.image}
                alt={`${shoe.brand} ${shoe.name}${shoe.sku&&knownText(shoe.color)?' · '+knownText(shoe.color):''} 제품 사진`}
              />
            </div>
            <span className="eyebrow">
              {shortPurpose(shoe.purpose)} · {shoe.brand}
            </span>
            {knownText(shoe.description) && <p className="shoe-description">{knownText(shoe.description)}</p>}
            <Facts
              values={knownFacts([
                ["신발 종류", shortPurpose(shoe.purpose)],
                ["훈련 용도", trainingText(shoe.uses)],
                ["카본·보강판", shoe.plate],
                ["무게", shoe.weight],
                ["굽 차이", shoe.drop],
                ["가격", productPrice(shoe)],
                ["성별", shoe.gender],
                ["제품번호", shoe.sku],
                ["사진 속 색상", shoe.sku?shoe.color:''],
                [
                  "모델 출시",
                  shoe.release
                    ? releaseLabel(shoe.release)
                    : "",
                ],
              ])}
            />
            {Object.keys(fitFor(shoe.id,shoe.source)).some(key=>key!=='source') && <section className="fit-detail">
              <Heading
                title="착용 특징"
                action="내 이야기로 찾기"
                onClick={() => open({ type: "fit" })}
              />
              <Facts
                values={knownFacts([
                  ["발볼", fitFor(shoe.id, shoe.source).width],
                  ["앞쪽 여유", fitFor(shoe.id, shoe.source).forefoot],
                  ["발등", fitFor(shoe.id, shoe.source).instep],
                  ["뒤꿈치", fitFor(shoe.id, shoe.source).heel],
                  ["사이즈", fitFor(shoe.id, shoe.source).size],
                ])}
              />
            </section>}
            <button
              className="primary wide"
              onClick={() => toggle(shoe.id, favorites, setFavorites)}
            >
              <Heart
                size={18}
                weight={favorites.includes(shoe.id) ? "fill" : "regular"}
              />
              {favorites.includes(shoe.id)
                ? "관심 모델 저장됨"
                : "관심 모델 저장"}
            </button>
            <button
              className="link-row"
              onClick={() => {
                setFeedTag("러닝화 후기");
                nav("소통");
              }}
            >
              <ChatCircleDots size={19} />
              러닝화 이야기 보기
              <CaretRight size={17} />
            </button>
            <a
              className="merchant-link"
              href={shoe.source}
              target="_blank"
              rel="noreferrer"
            >
              <span className="merchant-mark">
                <ShieldCheck size={22} />
              </span>
              <span>
                <strong>제품 보러 가기</strong>
              </span>
              <span className="merchant-price">
                {productPrice(shoe)}
                <CaretRight size={16} />
              </span>
            </a>
          </div>
        )}
        {modal?.type === "search" && (
          <div className="search-sheet">
            <div className="search-box">
              <MagnifyingGlass size={20} />
              <KeyboardInput
                aria-label="통합 검색어"
                placeholder="대회, 지역, 러닝화 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  aria-label="검색어 지우기"
                  onClick={() => setSearch("")}
                >
                  <X size={17} />
                </button>
              )}
            </div>
            <h3 className="field-title">
              {search ? "검색 결과" : "이렇게 찾아보세요"}
            </h3>
            {!search && (
              <div className="choice-grid">
                {["서울", "10km", "하프", "카본"].map((v) => (
                  <button
                    key={v}
                    className="choice"
                    onClick={() => setSearch(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
            {search &&
              races
                .filter((r) =>
                  (r.name + r.region + r.distances.join("")).includes(search),
                )
                .map((r) => (
                  <button
                    className="search-result"
                    key={r.id}
                    onClick={() => open({ type: "race", id: r.id })}
                  >
                    <CalendarBlank size={21} />
                    <span>
                      <strong>{r.name}</strong>
                      <small>
                        대회 {formatDate(r.raceAt)} · {r.region}
                      </small>
                    </span>
                    <CaretRight size={16} />
                  </button>
                ))}
            {search &&
              shoes
                .filter((s) =>
                  (s.name + s.brand + s.purpose + s.plate + s.sku)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((s) => (
                  <button
                    className="search-result"
                    key={s.id}
                    onClick={() => open({ type: "shoe", id: s.id })}
                  >
                    <Sneaker size={21} />
                    <span>
                      <strong>{s.name}</strong>
                      <small>{shortPurpose(s.purpose)}</small>
                    </span>
                    <CaretRight size={16} />
                  </button>
                ))}
            {search &&
              !races.some((r) =>
                (r.name + r.region + r.distances.join("")).includes(search),
              ) &&
              !shoes.some((s) =>
                (s.name + s.brand + s.purpose + s.plate + s.sku)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              ) && (
                <Empty
                  title="검색 결과가 없어요"
                  text="다른 이름이나 지역으로 찾아보세요."
                />
              )}
          </div>
        )}
        {modal?.type === "inbox" && (
          <div className="detail-content">
            {alarms.length ? (
              alarms.map((a) => (
                <button
                  className="inbox-item"
                  key={a.id}
                  onClick={() => alarm(a.id)}
                >
                  <Bell size={21} />
                  <span>
                    <strong>{races.find((r) => r.id === a.id)?.name}</strong>
                    <small>
                      {a.target==='close'?'접수 마감':a.target==='race'?'대회 전':'접수 시작'} · {a.lead} · {a.changes ? "변경 알림 포함" : "선택 시점만"}
                    </small>
                    <em>조건 저장됨 · 발송 서비스 연결 대기</em>
                  </span>
                  <CaretRight size={16} />
                </button>
              ))
            ) : (
              <Empty
                title="아직 등록한 알림이 없어요"
                text="관심 대회의 종 모양을 눌러 보세요."
              />
            )}
            <Info text="이 목록은 알림 조건입니다. 실제 발송 이력이나 발송 성공을 의미하지 않습니다." />
          </div>
        )}
        {modal?.type === "compare" && (
          <Comparison
            labels={[
              "대회 개최",
              "접수 시작",
              "거리",
              "지역",
              "참가비",
              "접수 회차",
            ]}
            items={races
              .filter((r) => compare.includes(r.id))
              .map((r) => ({
                id: r.id,
                name: r.name,
                values: [
                  formatDate(r.raceAt),
                  formatDate(r.opensAt, true),
                  r.distances.join(" / "),
                  r.region,
                  money(r.price),
                  r.round,
                ],
              }))}
          />
        )}
        {modal?.type === "shoeCompare" && (
          <div>
            <Segment
              values={["한눈에 비교", "자세히 비교"]}
              value={compareDetail ? "자세히 비교" : "한눈에 비교"}
              onChange={(v) => setCompareDetail(v === "자세히 비교")}
            />
            <Comparison
              verified
              labels={
                compareDetail
                  ? [
                      "브랜드",
                      "신발 종류",
                      "훈련 용도",
                      "가격",
                      "발볼",
                      "앞쪽 여유",
                      "발등",
                      "뒤꿈치",
                      "사이즈",
                      "무게",
                      "굽 차이",
                      "카본·보강판",
                      "성별",
                      "제품번호",
                      "사진 속 색상",
                      "모델 출시",
                    ]
                  : [
                      "신발 종류",
                      "훈련 용도",
                      "가격",
                      "사이즈",
                      "발등",
                      "무게",
                      "굽 차이",
                      "카본·보강판",
                    ]
              }
              items={shoes
                .filter((s) => shoeCompare.includes(s.id))
                .map((s) => ({
                  id: s.id,
                  name: s.name,
                  image: s.image,
                  url: s.source,
                  values: compareDetail
                    ? [
                        s.brand,
                        shortPurpose(s.purpose),
                        trainingText(s.uses),
                        productPrice(s),
                        fitFor(s.id, s.source).width,
                        fitFor(s.id, s.source).forefoot,
                        fitFor(s.id, s.source).instep,
                        fitFor(s.id, s.source).heel,
                        fitFor(s.id, s.source).size,
                        s.weight,
                        s.drop,
                        s.plate,
                        s.gender,
                        s.sku || "",
                        s.sku?s.color:'',
                        releaseLabel(s.release),
                      ]
                    : [
                        shortPurpose(s.purpose),
                        trainingText(s.uses),
                        productPrice(s),
                        fitFor(s.id, s.source).size,
                        fitFor(s.id, s.source).instep,
                        s.weight,
                        s.drop,
                        s.plate,
                      ],
                }))}
            />
          </div>
        )}
        {modal?.type === "post" && post && (
          <div className="detail-content">
            <div className="post-author">
              <span className="avatar">{post.initials}</span>
              <span>
                <strong>{post.name}</strong>
                <small>
                  {post.time} · {post.tag}
                </small>
              </span>
            </div>
            <h3>{post.title}</h3>
            <p className="post-detail-text">{post.content}</p>
            {post.url ? (
              <a
                className="primary wide"
                href={post.url}
                target="_blank"
                rel="noreferrer"
              >
                댓글·대화 열기
                <CaretRight size={18} />
              </a>
            ) : (
              <>
                <div className="comment-example">
                  <strong>러닝봄 안내</strong>
                  <p>
                    대회별 질문·답변과 장비 후기가 이곳에 연결됩니다. 현재는
                    화면 검토용 예시 글입니다.
                  </p>
                </div>
                <button
                  className="secondary wide"
                  onClick={() => open({ type: "compose" })}
                >
                  이야기 초안 써보기
                </button>
                <Info text="실제 댓글·대화·신고·차단은 서비스 연결 후 이용할 수 있어요. 현재 다른 사람에게 전송되거나 공개 게시되지 않습니다." />
              </>
            )}
          </div>
        )}
        {modal?.type === "compose" && (
          <div className="detail-content">
            <label className="field-title" htmlFor="draft">
              나의 이야기 초안
            </label>
            <KeyboardTextarea
              id="draft"
              className="draft-area"
              value={draft}
              placeholder="오늘의 러닝, 궁금한 대회, 신어본 러닝화 이야기…"
              onChange={(e) => setDraft(e.target.value)}
            />
            <Info text="초안은 이 브라우저에 자동 저장됩니다. 커뮤니티 서버 연결 전에는 게시·전송되지 않습니다." />
            <button
              className="primary wide"
              onClick={() => {
                close();
                setToast(
                  "초안을 이 기기에 보관했어요. 공개 게시하지 않았습니다.",
                );
              }}
            >
              초안 보관하기
            </button>
          </div>
        )}
        {modal?.type === "account" && <div className="detail-content"><Suspense fallback={<p>계정을 준비하고 있어요.</p>}><MemberAccount onDone={close}/></Suspense></div>}
        {modal?.type === "premium" && (
          <div className="detail-content premium-detail">
            <Sparkle size={40} weight="duotone" />
            <h3>달리기에 더 집중할 수 있도록.</h3>
            <p>
              지역·거리 조건별 브리핑, 여러 시점의 접수 알림, 대회 준비와 관심
              장비 관리를 한곳에.
            </p>
            <ul>
              <li>기본 일정과 중요한 정정은 무료</li>
              <li>고급 알림·개인 브리핑은 유료화 후보</li>
              <li>제휴 링크와 협찬은 광고 표시</li>
              <li>구독 가격·결제는 아직 운영하지 않음</li>
            </ul>
            <button className="secondary wide" onClick={close}>
              준비 화면으로 돌아가기
            </button>
          </div>
        )}
        {modal?.type === "fit" && (
          <Suspense fallback={<div className="detail-content"><p className="finder-lead">신발 찾기를 준비하고 있어요.</p></div>}>
            <ShoeFinder products={shoes} onProduct={(id) => open({ type: "shoe", id })} onBrowse={() => { close(); nav("장비"); }} />
          </Suspense>
        )}
        {modal?.type === "about" && (
          <div className="detail-content">
            <h3>가볍게 찾고, 놓치지 않게.</h3>
            <p className="about-copy">
              대회 접수와 러닝화, 러너의 이야기를 한곳에서 확인하세요. 운영 정보는
              검증을 거쳐 차근차근 연결하고 있어요.
            </p>
            <Facts
              values={[
                [
                  "지금 작동",
                  "탐색·필터·달력·비교·기기 저장·초안·ICS 내보내기",
                ],
                [
                  "현재 데이터",
                  "출처 기반 대회 일정과 공식 제품 사진·가격 스냅샷",
                ],
                ["회원 기능", "전용 DB 연결 · 회원 글·댓글·대화·신고·차단"],
                ["연결 대기", "운영 배포·간편 로그인 제공자·서버 알림·제휴·결제"],
              ]}
            />
            <Info text="상용 서비스 완성본이 아닌 통합 화면 검토 버전입니다. 엔진별 통합과 공식 데이터 검증을 거쳐 공개합니다." />
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function Heading({
  title,
  action,
  onClick,
}: {
  title: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {action && (
        <button onClick={onClick}>
          {action}
          <CaretRight size={14} />
        </button>
      )}
    </div>
  );
}
function PageTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
  );
}
function Segment({
  values,
  value,
  onChange,
}: {
  values: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="segmented" role="group">
      {values.map((v) => (
        <button
          key={v}
          className={value === v ? "active" : ""}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
function Chips({
  label,
  values,
  value,
  onChange,
  displayValue = (value:string) => value,
}: {
  label: string;
  values: string[];
  value: string;
  onChange: (v: string) => void;
  displayValue?: (v:string) => string;
}) {
  return (
    <Carousel ariaLabel={label} className="chip-carousel">
      <div className="chip-track">
        {values.map((v) => (
          <button
            key={v}
            className={value === v ? "chip active" : "chip"}
            aria-pressed={value === v}
            onClick={() => onChange(v)}
          >
            {displayValue(v)}
          </button>
        ))}
      </div>
    </Carousel>
  );
}
function Info({ text }: { text: string }) {
  return (
    <p className="info-note">
      <ShieldCheck size={17} />
      <span>{text}</span>
    </p>
  );
}
function Sample() {
  return null;
}
function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <CalendarBlank size={31} />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
function Facts({ values }: { values: string[][] }) {
  return (
    <dl className="fact-list">
      {knownFacts(values.map(([key,value])=>[key,value] as const)).map(([k, v]) => (
        <div key={k} className={k === "접수 시작" ? "accent-fact" : ""}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
function RaceRow({
  race: r,
  compact,
  axis,
  alarm,
  onOpen,
  onAlarm,
  focusOverride,
}: {
  race: Race;
  compact?: boolean;
  axis: string;
  alarm: boolean;
  onOpen: () => void;
  onAlarm: () => void;
  focusOverride?:{label:string;date:string};
}) {
  const focus=focusOverride||raceFocus(r,axis);
  return (
    <article className={"race-row " + (compact ? "compact " : "")+(!r.image?'without-photo':'')}>
      {r.image && <button
        className={'race-thumbnail layout-'+raceMediaLayout(r)}
        aria-label={`${r.name} 상세`}
        onClick={onOpen}
      >
        <RacePhoto race={r}/>
      </button>}
      <button className="race-copy" onClick={onOpen}>
        <strong>{r.name}</strong>
        <small>
          <MapPin weight="fill" />
          {r.region} · {r.venue}
        </small>
        <small>
          <Sneaker />
          {r.distances.join(" / ")}
        </small>
      </button>
      <div className="race-row-footer">
        {focus.date && <div className="race-date"><small>{focus.label}</small><strong>{formatDate(focus.date)}</strong></div>}
        <span className={'race-status '+(r.status==='마감임박'?'closing':'')}>{r.status==='접수마감'?'접수 마감':r.status==='접수중'?'접수 중':r.status==='마감임박'?'마감 임박':r.status==='예정'?'접수 예정':r.status}</span>
        <button className={"alarm-button " + (alarm ? "active" : "")} aria-label={`${r.name} 알림 설정`} aria-pressed={alarm} onClick={onAlarm}><Bell size={20} weight={alarm ? "fill" : "regular"} /></button>
      </div>
    </article>
  );
}
function Comparison({
  items,
  labels,
  verified = false,
}: {
  items: {
    id: string;
    name: string;
    values: (string | undefined)[];
    image?: string;
    url?: string;
  }[];
  labels: string[];
  verified?: boolean;
}) {
  return (
    <div className="detail-content">
      <Carousel ariaLabel="비교 표" className="comparison-carousel" contentClassName={items.length<=2?'two-product-columns':undefined}>
        <table className={"comparison-table "+(items.length<=2?'two-products':'many-products')}>
          <thead>
            <tr>
              <th>비교 항목</th>
              {items.map((i) => (
                <th key={i.id}>
                  {i.image && <ProductPhoto src={i.image} alt={i.name} />}
                  <span>{i.name}</span>
                  {i.url && (
                    <a href={i.url} target="_blank" rel="noreferrer">
                      {verified?'제품 보기':'대회 보기'}
                      <CaretRight size={12} />
                    </a>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, n) => ({label,n})).filter(({n})=>items.every(item=>knownText(item.values[n]))).map(({label,n}) => (
              <tr key={label}>
                <th>{label}</th>
                {items.map((i) => (
                  <td key={i.id}>{knownText(i.values[n])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Carousel>
    </div>
  );
}

function ProductPhoto({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return failed ? (
    <span className="photo-unavailable">공식 사진을 불러오지 못했어요</span>
  ) : (
    <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />
  );
}

function RacePhoto({race,detail=false}:{race:Race;detail?:boolean}){const [failedUrl,setFailedUrl]=useState('');return race.image&&race.image!==failedUrl?<img className={'race-media-photo layout-'+raceMediaLayout(race)+(detail?' race-media-detail':'')} src={race.image} alt={`${race.name} 대회 대표 이미지`} loading="lazy" decoding="async" onError={()=>setFailedUrl(race.image)}/>:null;}
