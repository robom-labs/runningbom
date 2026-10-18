import type {Race} from './catalog';
export type CalendarEntry={race:Race;kind:'open'|'close'|'race';label:string;date:string};
export const calendarDateKey=(date:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(date);
export function calendarEntries(races:Race[],axis:string):CalendarEntry[]{
 return races.flatMap<CalendarEntry>(race=>axis==='접수 일정'
  ? [{race,kind:'open' as const,label:'접수 시작',date:race.opensAt},{race,kind:'close' as const,label:'접수 마감',date:race.closesAt}]
  : [{race,kind:'race' as const,label:'대회 개최',date:race.raceAt}])
  .filter(entry=>/^20\d{2}-\d{2}-\d{2}/.test(entry.date)&&Number.isFinite(Date.parse(entry.date)))
  .sort((a,b)=>a.date.localeCompare(b.date)||a.race.name.localeCompare(b.race.name));
}
