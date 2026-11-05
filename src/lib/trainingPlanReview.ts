/** Plan metadata is global; reviewing a plan never edits its sessions or exercises. */
export type TrainingPlanReviewSettings={
  trainingPlanId?:string;trainingPlanStartedOn?:string;trainingPlanReviewedOn?:string;
  trainingPlanReviewEnabled?:boolean;trainingPlanReviewTime?:string;
};
export type TrainingPlanReview={dueOn:string;nextOn:string;overdue:boolean};

/** Calendar guidance for a new session only; never changes a saved session's week. */
export function getTrainingPlanWeek(start:string|undefined,date:string):1|2|3|4 {
  if(!validDate(start)||!validDate(date)||date<start)return 1;
  const days=Math.floor((Date.parse(`${date}T12:00:00Z`)-Date.parse(`${start}T12:00:00Z`))/86400000);
  return Math.min(4,Math.floor(days/7)+1) as 1|2|3|4;
}

function validDate(value:unknown):value is string {
  return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)
    &&Number(value.slice(0,4))>=1900&&Number(value.slice(0,4))<=2200
    &&Number.isFinite(Date.parse(`${value}T12:00:00Z`))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;
}
const monthDifference=(from:string,to:string)=>(Number(to.slice(0,4))-Number(from.slice(0,4)))*12+Number(to.slice(5,7))-Number(from.slice(5,7));

/** Every result is derived from the original start: Jan31 -> Feb28 -> Mar31. */
export function trainingPlanAnniversary(start:string,months:number):string {
  if(!validDate(start)||!Number.isInteger(months)||months<0||months>3600)return '';
  const year=Number(start.slice(0,4)),month=Number(start.slice(5,7))-1,day=Number(start.slice(8,10));
  const target=new Date(Date.UTC(year,month+months,1,12));
  const lastDay=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0,12)).getUTCDate();
  target.setUTCDate(Math.min(day,lastDay));
  const result=target.toISOString().slice(0,10);
  return validDate(result)?result:'';
}

export function getTrainingPlanReview(settings:TrainingPlanReviewSettings,today:string):TrainingPlanReview|null {
  const start=settings.trainingPlanStartedOn;
  if(settings.trainingPlanReviewEnabled===false||typeof settings.trainingPlanId!=='string'||!/^[a-zA-Z0-9_-]{1,120}$/.test(settings.trainingPlanId)
    ||!validDate(start)||!validDate(today))return null;
  const reviewed=settings.trainingPlanReviewedOn;
  const checkpoint=validDate(reviewed)&&reviewed>=start&&reviewed<=today?reviewed:start;
  // A review, including an early review, covers that calendar month. The next month
  // keeps the original anniversary day instead of drifting after a short February.
  const dueMonths=Math.max(1,monthDifference(start,checkpoint)+1),dueOn=trainingPlanAnniversary(start,dueMonths);
  let nextMonths=Math.max(dueMonths,monthDifference(start,today));
  let nextOn=trainingPlanAnniversary(start,nextMonths);
  if(nextOn&&nextOn<today)nextOn=trainingPlanAnniversary(start,++nextMonths);
  if(!dueOn||!nextOn)return null;
  return {dueOn,nextOn,overdue:today>=dueOn};
}

/** Date candidates only; the alarm layer filters elapsed local times before delivery. */
export function getTrainingPlanReviewDates(settings:TrainingPlanReviewSettings,today:string,count=3):string[] {
  const review=getTrainingPlanReview(settings,today),start=settings.trainingPlanStartedOn;
  if(!review||!validDate(start)||!Number.isInteger(count)||count<1||count>12)return [];
  const month=monthDifference(start,review.nextOn);
  return Array.from({length:count},(_,offset)=>trainingPlanAnniversary(start,month+offset)).filter(Boolean);
}
