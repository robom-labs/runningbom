// Accepted information architecture, 2026-10-18. Existing route and notification keys are preserved.
export const primaryDestinations=['home','races','shoes','community','calendar'] as const;
export type PrimaryDestination=(typeof primaryDestinations)[number];
export type DestinationDefinition={id:PrimaryDestination;label:string;accessibilityLabel:string;icon:string;activeIcon:string;emphasized?:boolean};
export const destinations:DestinationDefinition[]=[
 {id:'home',label:'오늘',accessibilityLabel:'오늘, 다음 대회와 러닝봄 PICK',icon:'home-outline',activeIcon:'home'},
 {id:'races',label:'대회',accessibilityLabel:'대회, 접수와 마감 일정',icon:'trophy-outline',activeIcon:'trophy'},
 {id:'shoes',label:'장비',accessibilityLabel:'장비, 실제 러닝화 사진과 비교',icon:'footsteps-outline',activeIcon:'footsteps'},
 {id:'community',label:'소통',accessibilityLabel:'소통, 이야기와 대화와 내 계정',icon:'chatbubbles-outline',activeIcon:'chatbubbles'},
 {id:'calendar',label:'내 일정',accessibilityLabel:'내 일정, 관심 대회와 알림',icon:'calendar-outline',activeIcon:'calendar'},
];
const parents:Record<string,PrimaryDestination>={home:'home',races:'races',shoes:'shoes',community:'community',calendar:'calendar',stats:'calendar',badges:'calendar',profile:'calendar',settings:'calendar',voice:'calendar',help:'calendar',guide:'community'};
export function destinationForRoute(route:string){return parents[route];}
export function routeForDestination(id:PrimaryDestination){return id;}
export function isTopLevelRoute(route:string){return (primaryDestinations as readonly string[]).includes(route);}
export function tabBarVisible(route:string){return route!=='start';}
export function destinationFromLegacy(value:string|undefined):PrimaryDestination{if(value==='me')return 'calendar';return value&&parents[value]||'home';}
