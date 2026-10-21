import {getDateAccess} from './datePolicy';

/** A built-in, untimed practice using the same dated marks as the other habits. */
export const MEDITATION_HABIT_ID = 'meditation';
export function isMeditationComplete(checks:Record<string,boolean>,date:string):boolean {
  return checks[`${date}:${MEDITATION_HABIT_ID}`]===true;
}
/** Both manual and guided completion are explicit, idempotent writes for today only. */
export function setMeditationComplete(checks:Record<string,boolean>,date:string,complete:boolean,now:Date|number=Date.now()):Record<string,boolean> {
  if(!getDateAccess(date,now).canExecute)return checks;
  const key=`${date}:${MEDITATION_HABIT_ID}`;
  if(checks[key]===complete || (!complete && checks[key]===undefined))return checks;
  return {...checks,[key]:complete};
}
