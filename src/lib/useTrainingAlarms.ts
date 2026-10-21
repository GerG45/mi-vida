import {useEffect,useState} from 'react';
import type {TrainingSession} from './training';
import {isAndroidTrainingTimers,syncTrainingTimerAlarms,type TrainingTimerAlarmResult} from './trainingAlarms';

/** Owned by App: navigating to another date or tool must not silence a running timer. */
export function useTrainingAlarms(sessions:Record<string,TrainingSession>,scope:string|null,ready:boolean) {
  const native=isAndroidTrainingTimers();
  const [state,setState]=useState<{scope:string|null;result:TrainingTimerAlarmResult}>({scope,result:{native,armed:0,warning:null}});
  useEffect(()=>{
    // Auth is still resolving: preserve deadlines that Android already restored.
    // Once the owner is confirmed, replace reconciles that scope (including logout to local).
    if(!native||!ready)return;
    let active=true;
    const reconcile=()=>{
      void syncTrainingTimerAlarms({scope,sessions}).then(result=>{
        if(active)setState({scope,result});
      });
    };
    const visible=()=>{if(document.visibilityState==='visible')reconcile();};
    reconcile();
    window.addEventListener('focus',reconcile);
    document.addEventListener('visibilitychange',visible);
    return()=>{
      active=false;
      window.removeEventListener('focus',reconcile);
      document.removeEventListener('visibilitychange',visible);
      // Native deadlines intentionally survive navigation and the WebView being suspended.
    };
  },[native,sessions,scope,ready]);
  return state.scope===scope?state.result:{native,armed:0,warning:null};
}
