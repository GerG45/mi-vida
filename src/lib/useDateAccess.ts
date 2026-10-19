import {useEffect, useState} from 'react';
import {getDateAccess} from './datePolicy';

/** Refresh date-bound controls at midnight and when returning to the app. */
export function useDateAccess(date: string) {
  const [, setNow] = useState(() => Date.now());
  useEffect(() => {
    let rollover: number;
    const refresh = () => {
      window.clearTimeout(rollover);
      const current = Date.now();
      setNow(current);
      const midnight = new Date(current);
      midnight.setHours(24, 0, 0, 0);
      rollover = window.setTimeout(refresh, Math.max(1, midnight.getTime() - current + 25));
    };
    refresh();
    // Also catches a clock/time-zone change while the app remains open.
    const clockCheck = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearTimeout(rollover);
      window.clearInterval(clockCheck);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return getDateAccess(date);
}
