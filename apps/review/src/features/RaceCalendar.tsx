import {useMemo,useRef,useState,type ReactNode} from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import luxonPlugin from '@fullcalendar/luxon3';
import koLocale from '@fullcalendar/core/locales/ko';
import {CalendarBlank,CaretRight} from '@phosphor-icons/react';
import type {Race} from './catalog';
import {calendarEntries,calendarDateKey,type CalendarEntry} from './calendar';
import {useKeyboard} from '../mobile';
export default function RaceCalendar({races,axis,renderEntry}:{races:Race[];axis:string;renderEntry:(entry:CalendarEntry)=>ReactNode}){
 const today=calendarDateKey(new Date());const[day,setDay]=useState(today);
 const calendar=useRef<FullCalendar>(null);
 const keyboard=useKeyboard();
 const agenda=useRef<HTMLDivElement>(null);
 const monthGrid=useRef<HTMLDivElement>(null);
 const scrollTo=(heading:HTMLElement|null)=>requestAnimationFrame(()=>{const viewport=heading?.closest<HTMLElement>('.mobile-scroll');if(!heading||!viewport)return;const rect=viewport.getBoundingClientRect(),scale=rect.height/viewport.clientHeight||1;viewport.scrollTo({top:viewport.scrollTop+(heading.getBoundingClientRect().top-rect.top)/scale-16,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
 const showAgenda=()=>scrollTo(agenda.current);
 const selectDay=(value:string)=>{keyboard.hide();setDay(value);showAgenda();};
 const pickDay=(value:string)=>{keyboard.hide();calendar.current?.getApi().gotoDate(value);setDay(value);};
 const entries=useMemo(()=>calendarEntries(races,axis),[races,axis]);
 const byDay=useMemo(()=>{const map=new Map<string,CalendarEntry[]>();for(const entry of entries){const key=entry.date.slice(0,10);map.set(key,[...(map.get(key)||[]),entry]);}return map;},[entries]);
 const selected=byDay.get(day)||[];const next=entries.find(entry=>entry.date.slice(0,10)>day)?.date.slice(0,10);
 const selectedLabel=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'long'}).format(new Date(day+'T12:00:00+09:00'));
 return <section className="race-calendar" aria-label="대회 달력과 날짜별 목록">
  <div className="calendar-help"><CalendarBlank size={18}/><p>날짜를 누르면 아래에 일정이 나와요.</p></div>
  <div className="calendar-wrap calendar-compact" ref={monthGrid}><FullCalendar ref={calendar}
   plugins={[dayGridPlugin,interactionPlugin,luxonPlugin]} locale={koLocale} timeZone="Asia/Seoul"
   initialView="dayGridMonth" initialDate={today} height="auto" fixedWeekCount={false} showNonCurrentDates={false}
   headerToolbar={{left:'prev',center:'title',right:'next'}} buttonHints={{prev:'이전 달',next:'다음 달',today:'이번 달'}}
   datesSet={info=>{const month=calendarDateKey(info.view.currentStart).slice(0,7);setDay(current=>current.startsWith(month)?current:month+'-01');}}
   dateClick={info=>selectDay(info.dateStr.slice(0,10))}
   dayCellClassNames={info=>calendarDateKey(info.date)===day?['selected-day']:[]}
   dayCellContent={info=>{const key=calendarDateKey(info.date),rows=byDay.get(key)||[];return <button type="button" className="calendar-day-button" aria-label={`${key}, 일정 ${rows.length}개`} aria-pressed={key===day} onClick={event=>{event.stopPropagation();selectDay(key);}}>
    <span className="calendar-day-number">{Number(key.slice(-2))}</span>
    {rows.length>0&&<span className="calendar-day-count">{rows.length}개</span>}
   </button>;}}
  /></div>
  <div className="calendar-legend"><span>숫자는 그날의 일정 개수예요.</span><button onClick={()=>pickDay(today)}>오늘로</button></div>
  <div className="calendar-agenda-heading" aria-live="polite" ref={agenda}><h2>{selectedLabel}</h2><div className="calendar-agenda-tools"><span>{selected.length}개 일정</span><button onClick={()=>{keyboard.hide();scrollTo(monthGrid.current);}}><CalendarBlank size={17}/>달력</button></div></div>
  {selected.length?<div className="calendar-agenda">{selected.map(entry=><div className="race-list-item" key={entry.race.id+'-'+entry.kind}>{renderEntry(entry)}</div>)}</div>
   :<div className="calendar-empty"><p>이날은 등록된 일정이 없어요.</p>{next&&<button onClick={()=>pickDay(next)}>다음 일정 보기<CaretRight size={16}/></button>}</div>}
 </section>;
}
