import {useEffect, useRef} from 'react';

const focusableSelector = [
  'button:not(:disabled)', 'input:not(:disabled):not([type="hidden"])',
  'select:not(:disabled)', 'textarea:not(:disabled)', 'a[href]', 'summary',
  '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]',
].join(',');

/** Keep keyboard navigation inside an open dialog, then return to its trigger. */
export function useDialogFocus(open:boolean, onClose:()=>void) {
  const dialogRef=useRef<HTMLElement>(null);
  const closeRef=useRef(onClose);
  closeRef.current=onClose;

  useEffect(()=>{
    const dialog=dialogRef.current;
    if(!open||!dialog)return;
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const controls=()=>Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      .filter(control=>control.tabIndex>=0&&control.getClientRects().length>0&&!control.closest('[inert], [hidden], [aria-hidden="true"]'));
    const focusFirst=()=>{
      const available=controls();
      const firstField=available.find(control=>control.matches('input:not([type="checkbox"]):not([type="radio"]), textarea, select'));
      (firstField??available[0]??dialog).focus({preventScroll:true});
    };
    focusFirst();

    const keydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if(event.key!=='Tab')return;
      const available=controls();
      if(!available.length){event.preventDefault();dialog.focus({preventScroll:true});return;}
      const first=available[0],last=available[available.length-1];
      const focused=document.activeElement;
      if(event.shiftKey&&(focused===first||focused===dialog||!dialog.contains(focused))){
        event.preventDefault();last.focus({preventScroll:true});
      }else if(!event.shiftKey&&(focused===last||focused===dialog||!dialog.contains(focused))){
        event.preventDefault();first.focus({preventScroll:true});
      }
    };
    const containFocus=(event:FocusEvent)=>{
      if(event.target instanceof Node&&!dialog.contains(event.target))focusFirst();
    };
    document.addEventListener('keydown',keydown,true);
    document.addEventListener('focusin',containFocus);
    return()=>{
      document.removeEventListener('keydown',keydown,true);
      document.removeEventListener('focusin',containFocus);
      document.body.style.overflow=previousOverflow;
      if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
    };
  },[open]);

  return dialogRef;
}
