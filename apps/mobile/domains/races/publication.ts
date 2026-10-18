// Keep operational review records in the source snapshot, outside public screens.
type PublishableRace={id:string;name:string;raceDate:string;registrationDataStatus?:string;needsReview?:boolean};
export function publicRaceRows<T extends PublishableRace>(rows:T[],today:string):T[]{
 const canonical=rows.find(r=>r.id==='schedule-0e4e73276928');
 return rows.filter(r=>{
  const edition=r.name.match(/20\d{2}/)?.[0];
  return r.raceDate>=today&&!r.needsReview&&r.registrationDataStatus!=='needs-review'
   &&(!edition||edition===r.raceDate.slice(0,4))
   &&!(r.id==='schedule-dd6c6bcc11f2'&&canonical?.raceDate===r.raceDate);
 });
}
