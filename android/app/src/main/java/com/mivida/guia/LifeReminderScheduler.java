package com.mivida.guia;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** All operations share one lock; stale PendingIntents cannot deliver replaced records. */
final class LifeReminderScheduler {
    static final String WAKE_CHANNEL = "mi_vida_wake_v1";
    static final String REMINDER_CHANNEL = "mi_vida_reminders_ding_v3";
    private static final String LEGACY_REMINDER_CHANNEL = "mi_vida_reminders_v2";
    private static final String WAKE_FALLBACK_CHANNEL = "mi_vida_wake_fallback_v1";
    static final String CHANGED = "com.mivida.guia.ALARM_CHANGED";
    static final int TEST_ID = -2147483000;
    static final int MAX_RECORDS = 200;
    private static final String PREFS = "mi_vida_reminders";
    private static final String KEY = "pending";
    private static final String ACTIVE = "active_alarm";
    private static final String ERROR = "last_error";
    private static final String ARMED = "batch_armed";
    private static final Object LOCK = new Object();

    private LifeReminderScheduler() {}

    static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel wake = new NotificationChannel(WAKE_CHANNEL, "Despertador", NotificationManager.IMPORTANCE_HIGH);
        wake.setDescription("Alarmas para levantarte; el sonido se reproduce hasta detener o posponer, durante un máximo de 10 minutos.");
        // The service owns alarm-stream audio, avoiding two simultaneous sounds.
        wake.setSound(null, null);
        wake.enableVibration(false);
        wake.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
        manager.createNotificationChannel(wake);
        // Android keeps channel sounds after creation. A new ID applies the chosen
        // ding on upgrades, while an existing v3 keeps the user's later choices.
        if (manager.getNotificationChannel(REMINDER_CHANNEL) == null) {
            NotificationChannel previous = manager.getNotificationChannel(LEGACY_REMINDER_CHANNEL);
            NotificationChannel reminder = new NotificationChannel(REMINDER_CHANNEL, "Recordatorios · tono suave",
                previous == null ? NotificationManager.IMPORTANCE_HIGH : previous.getImportance());
            reminder.setDescription("Compromisos y actividades con el tono ding de Mi Vida. El despertador usa el sonido de alarma del teléfono.");
            reminder.setSound(previous != null && previous.getSound() == null ? null : reminderSound(context),
                new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            if (previous != null) {
                reminder.setVibrationPattern(previous.getVibrationPattern());
                reminder.enableVibration(previous.shouldVibrate());
                reminder.enableLights(previous.shouldShowLights());
                reminder.setLightColor(previous.getLightColor());
                reminder.setShowBadge(previous.canShowBadge());
                reminder.setLockscreenVisibility(previous.getLockscreenVisibility());
                if (previous.getGroup() != null) reminder.setGroup(previous.getGroup());
            } else reminder.enableVibration(true);
            manager.createNotificationChannel(reminder);
        }
    }

    private static Uri reminderSound(Context context) {
        // Resource names remain stable when numeric resource IDs change on upgrade.
        return Uri.parse("android.resource://" + context.getPackageName() + "/raw/mi_vida_reminder_ding");
    }

    static boolean notificationsEnabled(Context context) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        return NotificationManagerCompat.from(context).areNotificationsEnabled() && channelEnabled(context, WAKE_CHANNEL) && channelEnabled(context, REMINDER_CHANNEL);
    }

    static boolean channelEnabled(Context context, String name) {
        if (Build.VERSION.SDK_INT < 26) return true;
        NotificationChannel channel = context.getSystemService(NotificationManager.class).getNotificationChannel(name);
        return channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
    }

    static boolean exactAlarmsEnabled(Context context) {
        AlarmManager manager = context.getSystemService(AlarmManager.class);
        return manager != null && (Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms());
    }

    static boolean fullScreenEnabled(Context context) {
        return Build.VERSION.SDK_INT < 34 || context.getSystemService(NotificationManager.class).canUseFullScreenIntent();
    }

    private static SharedPreferences preferences(Context context) { return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    static JSONArray read(Context context) {
        try { return new JSONArray(preferences(context).getString(KEY, "[]")); }
        catch (JSONException ignored) { return new JSONArray(); }
    }
    static JSONObject active(Context context) {
        try { return new JSONObject(preferences(context).getString(ACTIVE, "{}")); }
        catch (JSONException ignored) { return new JSONObject(); }
    }
    static void setActive(Context context, JSONObject record) {
        if (!preferences(context).edit().putString(ACTIVE, record.toString()).commit()) throw new IllegalStateException("No se pudo guardar la alarma activa.");
        context.sendBroadcast(new Intent(CHANGED).setPackage(context.getPackageName()));
    }
    static void clearActive(Context context) {
        preferences(context).edit().remove(ACTIVE).apply();
        context.sendBroadcast(new Intent(CHANGED).setPackage(context.getPackageName()));
    }
    static void error(Context context, String message) { preferences(context).edit().putString(ERROR, message).apply(); }
    static String lastError(Context context) { return preferences(context).getString(ERROR, null); }
    static void clearError(Context context) { preferences(context).edit().remove(ERROR).apply(); }
    static boolean isArmed(Context context) { return preferences(context).getBoolean(ARMED, false); }
    private static void markArmed(Context context, boolean armed) { preferences(context).edit().putBoolean(ARMED, armed).apply(); }
    private static void save(Context context, JSONArray reminders) {
        if (!preferences(context).edit().putString(KEY, reminders.toString()).commit()) throw new IllegalStateException("No se pudieron guardar las alarmas.");
    }

    private static PendingIntent alarmIntent(Context context, int id, long at, int flags) {
        Intent intent = new Intent(context, LifeReminderReceiver.class).setAction(context.getPackageName() + ".REMINDER." + id);
        intent.putExtra("reminderId", id).putExtra("reminderAt", at);
        return PendingIntent.getBroadcast(context, id, intent, flags | PendingIntent.FLAG_IMMUTABLE);
    }
    static PendingIntent openApp(Context context, int id) {
        Intent open = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private static void arm(Context context, JSONObject reminder) {
        if (reminder == null || reminder.optLong("at") <= System.currentTimeMillis()) return;
        if (!exactAlarmsEnabled(context)) throw new SecurityException("Falta el permiso de alarmas exactas.");
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        PendingIntent operation = alarmIntent(context, reminder.optInt("id"), reminder.optLong("at"), PendingIntent.FLAG_UPDATE_CURRENT);
        if ("wake".equals(reminder.optString("kind"))) {
            alarms.setAlarmClock(new AlarmManager.AlarmClockInfo(reminder.optLong("at"), openApp(context, reminder.optInt("id"))), operation);
        } else alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, reminder.optLong("at"), operation);
    }
    private static void cancelPending(Context context, JSONArray reminders) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        if (alarms == null) return;
        for (int i = 0; i < reminders.length(); i++) {
            JSONObject record = reminders.optJSONObject(i);
            if (record == null) continue;
            PendingIntent pending = alarmIntent(context, record.optInt("id"), 0, PendingIntent.FLAG_NO_CREATE);
            if (pending != null) { alarms.cancel(pending); pending.cancel(); }
        }
    }

    static void replace(Context context, JSONArray reminders) {
        synchronized (LOCK) {
            if (!notificationsEnabled(context) || !exactAlarmsEnabled(context)) throw new SecurityException("Revisá los permisos de notificaciones y alarmas exactas.");
            JSONArray previous = read(context), next = new JSONArray();
            java.util.HashSet<Integer> incomingIds = new java.util.HashSet<>();
            for (int i = 0; i < reminders.length(); i++) {
                JSONObject record = reminders.optJSONObject(i);
                next.put(record);
                if (record != null) incomingIds.add(record.optInt("id"));
            }
            // A sound check and an explicitly snoozed alarm survive an ordinary agenda refresh.
            for (int i = 0; i < previous.length(); i++) {
                JSONObject record = previous.optJSONObject(i);
                if (record != null && (record.optInt("id") == TEST_ID || record.optBoolean("snoozed"))
                    && !incomingIds.contains(record.optInt("id")) && record.optLong("at") > System.currentTimeMillis()) next.put(record);
            }
            markArmed(context, false);
            cancelPending(context, previous);
            try {
                for (int i = 0; i < next.length(); i++) arm(context, next.optJSONObject(i));
                save(context, next);
                markArmed(context, true);
                clearError(context);
            } catch (RuntimeException failure) {
                cancelPending(context, next);
                boolean restored = true;
                for (int i = 0; i < previous.length(); i++) { try { arm(context, previous.optJSONObject(i)); } catch (RuntimeException ignored) { restored = false; } }
                markArmed(context, restored);
                error(context, "Android no pudo actualizar las alarmas. Revisá los permisos.");
                throw failure;
            }
        }
    }
    static long test(Context context) {
        synchronized (LOCK) {
            if (!notificationsEnabled(context) || !exactAlarmsEnabled(context)) throw new SecurityException("Faltan permisos para la prueba.");
            try {
                long at = System.currentTimeMillis() + 30000;
                JSONObject test = new JSONObject().put("id", TEST_ID).put("at", at).put("kind", "wake")
                    .put("title", "Prueba del despertador").put("body", "Si escuchás esta alarma con la pantalla bloqueada, el sonido de Mi Vida está funcionando.");
                JSONArray current = read(context), next = new JSONArray();
                for (int i = 0; i < current.length(); i++) {
                    JSONObject item = current.optJSONObject(i);
                    if (item != null && item.optInt("id") != TEST_ID && item.optLong("at") > System.currentTimeMillis()) next.put(item);
                }
                arm(context, test);
                next.put(test);
                try { save(context, next); } catch (RuntimeException failure) { cancelPending(context, new JSONArray().put(test)); throw failure; }
                clearError(context);
                return at;
            } catch (JSONException impossible) { throw new IllegalStateException(impossible); }
        }
    }
    static void cancelAll(Context context) {
        synchronized (LOCK) {
            JSONArray pending = read(context);
            save(context, new JSONArray());
            markArmed(context, true);
            cancelPending(context, pending);
            LifeAlarmService.stop(context);
            NotificationManagerCompat.from(context).cancelAll();
            clearError(context);
        }
    }
    static void restore(Context context) {
        synchronized (LOCK) {
            createChannel(context);
            JSONArray pending = read(context), future = new JSONArray();
            long now = System.currentTimeMillis();
            for (int i = 0; i < pending.length() && future.length() < MAX_RECORDS * 2 + 1; i++) {
                JSONObject record = pending.optJSONObject(i);
                if (record != null && record.optLong("at") > now) future.put(record);
            }
            markArmed(context, false);
            cancelPending(context, pending);
            save(context, future);
            if (!notificationsEnabled(context) || !exactAlarmsEnabled(context)) {
                if (future.length() > 0) error(context, "Las alarmas guardadas necesitan permiso de notificaciones y alarmas exactas.");
                return;
            }
            for (int i = 0; i < future.length(); i++) arm(context, future.optJSONObject(i));
            markArmed(context, true);
        }
    }
    static void snooze(Context context, int expectedId) {
        synchronized (LOCK) {
            JSONObject record = active(context);
            if (!record.has("id") || record.optInt("id") != expectedId) return;
            if (!notificationsEnabled(context) || !exactAlarmsEnabled(context)) throw new SecurityException("No se pudo posponer: faltan permisos de alarmas o notificaciones.");
            try {
                JSONObject snoozed = new JSONObject(record.toString()).put("at", System.currentTimeMillis() + 600000).put("snoozed", true);
                JSONArray current = read(context), next = new JSONArray();
                for (int i = 0; i < current.length(); i++) {
                    JSONObject item = current.optJSONObject(i);
                    if (item != null && item.optInt("id") != expectedId && item.optLong("at") > System.currentTimeMillis()) next.put(item);
                }
                arm(context, snoozed);
                next.put(snoozed);
                try { save(context, next); } catch (RuntimeException failure) { cancelPending(context, new JSONArray().put(snoozed)); throw failure; }
                LifeAlarmService.stop(context);
                clearError(context);
            } catch (JSONException impossible) { throw new IllegalStateException(impossible); }
        }
    }
    static void deliver(Context context, int id, long expectedAt) {
        synchronized (LOCK) {
            JSONArray pending = read(context), remaining = new JSONArray();
            JSONObject current = null;
            for (int i = 0; i < pending.length(); i++) {
                JSONObject record = pending.optJSONObject(i);
                if (record == null) continue;
                if (record.optInt("id") == id) current = record;
                else remaining.put(record);
            }
            if (current == null || current.optLong("at") != expectedAt || expectedAt > System.currentTimeMillis() + 1000) return;
            save(context, remaining);
            createChannel(context);
            if (!notificationsEnabled(context)) { error(context, "Android bloqueó una alarma porque las notificaciones están desactivadas."); return; }
            // Old delivery after a clock jump must not ring hours late.
            if (System.currentTimeMillis() - expectedAt > 15 * 60000L) { error(context, "Se omitió una alarma vencida. Revisá la hora del teléfono."); return; }
            if ("wake".equals(current.optString("kind"))) {
                try { ContextCompat.startForegroundService(context, new Intent(context, LifeAlarmService.class).putExtra("alarm", current.toString())); }
                catch (RuntimeException failure) { error(context, "Android impidió reproducir el despertador. Abrí Mi Vida y revisá los permisos."); notifyReminder(context, current, true); }
            } else notifyReminder(context, current, false);
        }
    }
    static void notifyReminder(Context context, JSONObject current, boolean failedWake) {
        // A failed continuous wake alarm must never fall back to the secondary ding.
        if (failedWake && Build.VERSION.SDK_INT >= 26) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager.getNotificationChannel(WAKE_FALLBACK_CHANNEL) == null) {
                NotificationChannel fallback = new NotificationChannel(WAKE_FALLBACK_CHANNEL, "Respaldo del despertador", NotificationManager.IMPORTANCE_HIGH);
                fallback.setDescription("Aviso si Android no permite iniciar el despertador continuo.");
                fallback.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                    new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
                fallback.enableVibration(true);
                manager.createNotificationChannel(fallback);
            }
        }
        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, failedWake ? WAKE_FALLBACK_CHANNEL : REMINDER_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_life).setContentTitle(current.optString("title"))
            .setContentText(failedWake ? "No se pudo iniciar el sonido continuo. Revisá Mi Vida." : current.optString("body"))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(current.optString("body")))
            .setCategory(failedWake ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true)
            .setSound(failedWake ? RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM) : reminderSound(context))
            .setDefaults(NotificationCompat.DEFAULT_VIBRATE)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setContentIntent(openApp(context, current.optInt("id")));
        NotificationManagerCompat.from(context).notify("mi_vida_reminder", current.optInt("id"), notification.build());
    }
}
