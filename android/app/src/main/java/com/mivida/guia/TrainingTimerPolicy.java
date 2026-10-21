package com.mivida.guia;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Pure countdown boundary policy, shared by scheduling, restoring and delivery. */
final class TrainingTimerPolicy {
    private TrainingTimerPolicy() {}
    static String localDate(long at) { return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(at)); }
    static boolean sameDay(String date, long at, long now) {
        return date != null && date.matches("\\d{4}-\\d{2}-\\d{2}") && date.equals(localDate(now)) && date.equals(localDate(at));
    }
    static boolean canSchedule(String date, long at, long now) {
        return sameDay(date, at, now) && at > now && at - now <= 7_200_000L;
    }
    static boolean canDeliver(String date, long at, long now) {
        // A locked phone may deliver a few milliseconds late; never replay long expired timers.
        return sameDay(date, at, now) && at <= now + 250L && now - at <= 60_000L;
    }
}
