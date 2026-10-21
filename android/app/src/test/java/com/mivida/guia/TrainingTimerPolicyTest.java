package com.mivida.guia;

import org.junit.Test;
import static org.junit.Assert.*;
import java.util.Calendar;
import java.util.TimeZone;

public class TrainingTimerPolicyTest {
    private long at(int day, int hour, int minute, int second) {
        Calendar value = Calendar.getInstance(); value.clear(); value.set(2026, Calendar.OCTOBER, day, hour, minute, second); return value.getTimeInMillis();
    }
    @Test public void schedulesOnlyActualFutureSameDayCountdowns() {
        long now = at(21, 9, 0, 0);
        assertTrue(TrainingTimerPolicy.canSchedule("2026-10-21", now + 60_000L, now));
        assertFalse(TrainingTimerPolicy.canSchedule("2026-10-20", now + 60_000L, now));
        assertFalse(TrainingTimerPolicy.canSchedule("2026-10-22", now + 60_000L, now));
        assertFalse(TrainingTimerPolicy.canSchedule("2026-10-21", now, now));
        assertFalse(TrainingTimerPolicy.canSchedule("2026-10-21", now + 7_200_001L, now));
    }
    @Test public void countdownMayNotCrossMidnightOrBecomeYesterdayAfterSuspension() {
        long now = at(21, 23, 59, 45);
        assertTrue(TrainingTimerPolicy.canSchedule("2026-10-21", now + 5_000L, now));
        assertFalse(TrainingTimerPolicy.canSchedule("2026-10-21", now + 30_000L, now));
        assertFalse(TrainingTimerPolicy.canDeliver("2026-10-21", now + 5_000L, now + 20_000L));
    }
    @Test public void deliveryAllowsSmallJitterButRejectsEarlyOrExpiredBroadcasts() {
        long now = at(21, 9, 0, 0);
        assertTrue(TrainingTimerPolicy.canDeliver("2026-10-21", now, now + 5L));
        assertFalse(TrainingTimerPolicy.canDeliver("2026-10-21", now + 1_000L, now));
        assertFalse(TrainingTimerPolicy.canDeliver("2026-10-21", now, now + 60_001L));
    }
    @Test public void policyUsesLocalDateRatherThanUtc() {
        TimeZone previous = TimeZone.getDefault();
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("America/Argentina/Buenos_Aires"));
            long late = at(21, 23, 50, 0);
            assertEquals("2026-10-21", TrainingTimerPolicy.localDate(late));
            assertTrue(TrainingTimerPolicy.canSchedule("2026-10-21", late + 60_000L, late));
        } finally { TimeZone.setDefault(previous); }
    }
}
