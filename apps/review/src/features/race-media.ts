import type {Race} from './catalog';
export function raceMediaLayout(race:Pick<Race,'imageKind'|'imageWidth'|'imageHeight'>){
 if(race.imageKind?.includes('logo'))return 'logo';
 if(race.imageKind?.includes('poster'))return 'poster';
 const ratio=(race.imageWidth||0)/(race.imageHeight||1);
 return ratio>3?'banner':ratio>0&&ratio<.95?'poster':'photo';
}
