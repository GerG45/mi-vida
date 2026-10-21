package com.mivida.guia;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Exercise countdowns are independent of agenda replacement and wake-alarm playback. */
final class LifeTrainingTimerScheduler {
    static final int MAX_TIMERS = 32;
    private static final String PREFS = "mi_vida_training_timers_v1";
    private static final String CHANNEL = "mi_vida_training_ding_v1";
    private static final String TAG = "mi_vida_training";
    private static final Object LOCK = new Object();
    private LifeTrainingTimerScheduler() {}

    private static SharedPreferences preferences(Context context) { return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    private static JSONObject read(Context context) {
        try { return new JSONObject(preferences(context).getString("state", "{}")); }
        catch (JSONException ignored) { return new JSONObject(); }
    }
    private static JSONArray timers(JSONObject state) { JSONArray items = state.optJSONArray("timers"); return items == null ? new JSONArray() : items; }
    private static JSONArray consumed(JSONObject state, String scope, long now) {
        JSONArray result = new JSONArray(), old = state.optJSONArray("consumed");
        if (!scope.equals(state.optString("scope")) || old == null) return result;
        for (int i = Math.max(0, old.length() - 256); i < old.length(); i++) {
            JSONObject item = old.optJSONObject(i);
            if (item != null && TrainingTimerPolicy.localDate(now).equals(item.optString("date"))) result.put(item);
        }
        return result;
    }
    private static boolean wasConsumed(JSONArray consumed, JSONObject candidate) {
        for (int i = 0; i < consumed.length(); i++) {
            JSONObject item = consumed.optJSONObject(i);
            if (item != null && item.optString("key").equals(candidate.optString("key")) && item.optLong("at") == candidate.optLong("at") && item.optString("date").equals(candidate.optString("date"))) return true;
        }
        return false;
    }
    private static void save(Context context, String scope, JSONArray items, JSONArray consumed) {
        try {
            String encoded = new JSONObject().put("scope", scope).put("timers", items).put("consumed", consumed).toString();
            if (!preferences(context).edit().putString("state", encoded).commit()) throw new IllegalStateException("No se pudieron guardar los avisos del entrenamiento.");
        } catch (JSONException impossible) { throw new IllegalStateException(impossible); }
    }
    static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Entrenamiento · tono suave", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Aviso breve al terminar el descanso o el contador de una serie, incluso con Mi Vida en segundo plano.");
        channel.setSound(sound(context), new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        channel.enableVibration(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        // Creating an existing channel respects all later sound and volume choices made by its owner.
        manager.createNotificationChannel(channel);
    }
    private static Uri sound(Context context) { return Uri.parse("android.resource://" + context.getPackageName() + "/raw/mi_vida_reminder_ding"); }
    private static String warning(Context context) {
        if ((Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            || !NotificationManagerCompat.from(context).areNotificationsEnabled()) return "Activá las notificaciones de Mi Vida en Ajustes → Alarmas para escuchar los avisos del entrenamiento con el celular bloqueado.";
        if (!LifeReminderScheduler.exactAlarmsEnabled(context)) return "Activá Alarmas y recordatorios para Mi Vida en Ajustes → Alarmas: los descansos y las series necesitan avisos puntuales.";
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = context.getSystemService(NotificationManager.class).getNotificationChannel(CHANNEL);
            if (channel != null && (channel.getImportance() < NotificationManager.IMPORTANCE_DEFAULT || channel.getSound() == null)) return "El canal Entrenamiento · tono suave está silenciado. Revisá su sonido en los ajustes de notificaciones de Android.";
        }
        return null;
    }
    static JSONObject status(Context context) {
        synchronized (LOCK) {
            createChannel(context);
            JSONArray items = timers(read(context)); int count = 0; long now = System.currentTimeMillis();
            for (int i = 0; i < items.length(); i++) { JSONObject item = items.optJSONObject(i); if (item != null && TrainingTimerPolicy.canSchedule(item.optString("date"), item.optLong("at"), now)) count++; }
            try { return new JSONObject().put("armed", warning(context) == null ? count : 0).put("warning", warning(context) == null ? JSONObject.NULL : warning(context)); }
            catch (JSONException impossible) { throw new IllegalStateException(impossible); }
        }
    }
    private static PendingIntent alarmIntent(Context context, JSONObject item, int flags) {
        // Data is part of PendingIntent identity; agenda IDs and other scopes cannot collide.
        Intent intent = new Intent(context, LifeTrainingTimerReceiver.class).setAction(context.getPackageName() + ".TRAINING_TIMER")
            .setData(Uri.parse("mivida-training://timer/" + Uri.encode(item.optString("token"))))
            .putExtra("token", item.optString("token")).putExtra("at", item.optLong("at"));
        return PendingIntent.getBroadcast(context, 0, intent, flags | PendingIntent.FLAG_IMMUTABLE);
    }
    private static PendingIntent openApp(Context context) {
        Intent intent = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(context, 21044361, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private static void arm(Context context, JSONObject item) {
        if (!TrainingTimerPolicy.canSchedule(item.optString("date"), item.optLong("at"), System.currentTimeMillis())) return;
        AlarmManager manager = context.getSystemService(AlarmManager.class);
        if (manager == null || !LifeReminderScheduler.exactAlarmsEnabled(context)) throw new SecurityException("Falta permiso de Alarmas y recordatorios.");
        // Explicit, visible short countdowns must not hit the idle quota for repeated
        // setExactAndAllowWhileIdle calls. No wake service/full-screen intent is used.
        manager.setAlarmClock(new AlarmManager.AlarmClockInfo(item.optLong("at"), openApp(context)), alarmIntent(context, item, PendingIntent.FLAG_UPDATE_CURRENT));
    }
    private static void cancel(Context context, JSONArray items) {
        AlarmManager manager = context.getSystemService(AlarmManager.class);
        if (manager == null) return;
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i); if (item == null) continue;
            PendingIntent pending = alarmIntent(context, item, PendingIntent.FLAG_NO_CREATE);
            if (pending != null) { manager.cancel(pending); pending.cancel(); }
        }
    }
    private static JSONObject matching(JSONArray previous, JSONObject next) {
        for (int i = 0; i < previous.length(); i++) {
            JSONObject item = previous.optJSONObject(i);
            if (item != null && item.optString("key").equals(next.optString("key")) && item.optLong("at") == next.optLong("at")
                && item.optString("date").equals(next.optString("date")) && item.optString("title").equals(next.optString("title")) && item.optString("body").equals(next.optString("body"))) return item;
        }
        return null;
    }
    static void replace(Context context, String scope, JSONArray input) {
        synchronized (LOCK) {
            createChannel(context);
            JSONObject oldState = read(context); JSONArray old = timers(oldState), next = new JSONArray(), used = consumed(oldState, scope, System.currentTimeMillis());
            boolean sameOwner = scope.equals(oldState.optString("scope"));
            try {
                long now = System.currentTimeMillis();
                for (int i = 0; i < input.length(); i++) {
                    JSONObject item = input.getJSONObject(i);
                    if (!TrainingTimerPolicy.canSchedule(item.optString("date"), item.optLong("at"), now) || wasConsumed(used, item)) continue;
                    JSONObject previous = sameOwner ? matching(old, item) : null;
                    next.put(new JSONObject(item.toString()).put("token", previous == null ? UUID.randomUUID().toString() : previous.optString("token")));
                }
                // Persist the new owner/revision before cancelling: stale broadcasts now fail closed.
                save(context, scope, next, used);
                cancel(context, old);
                NotificationManagerCompat.from(context).cancel(TAG, 1);
                if (warning(context) != null) return;
                try { for (int i = 0; i < next.length(); i++) arm(context, next.optJSONObject(i)); }
                catch (RuntimeException failure) { cancel(context, next); save(context, scope, new JSONArray(), used); throw failure; }
            } catch (JSONException impossible) { throw new IllegalStateException(impossible); }
        }
    }
    static void cancelAll(Context context) {
        synchronized (LOCK) {
            JSONArray old = timers(read(context)); save(context, "", new JSONArray(), new JSONArray()); cancel(context, old);
            NotificationManagerCompat.from(context).cancel(TAG, 1);
        }
    }
    static void restore(Context context) {
        synchronized (LOCK) {
            JSONObject state = read(context);
            replace(context, state.optString("scope"), timers(state));
        }
    }
    static void deliver(Context context, String token, long expectedAt) {
        synchronized (LOCK) {
            JSONObject state = read(context); JSONArray old = timers(state), next = new JSONArray(); JSONObject current = null;
            for (int i = 0; i < old.length(); i++) {
                JSONObject item = old.optJSONObject(i); if (item == null) continue;
                if (token.equals(item.optString("token")) && expectedAt == item.optLong("at")) current = item; else next.put(item);
            }
            if (current == null) return;
            JSONArray used = consumed(state, state.optString("scope"), System.currentTimeMillis());
            try { used.put(new JSONObject().put("key", current.optString("key")).put("date", current.optString("date")).put("at", current.optLong("at"))); }
            catch (JSONException impossible) { throw new IllegalStateException(impossible); }
            save(context, state.optString("scope"), next, used); // Consume once, even if permission/audio was disabled.
            if (!TrainingTimerPolicy.canDeliver(current.optString("date"), expectedAt, System.currentTimeMillis())) return;
            createChannel(context); if (warning(context) != null) return;
            NotificationCompat.Builder notice = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_life).setContentTitle(current.optString("title")).setContentText(current.optString("body"))
                .setStyle(new NotificationCompat.BigTextStyle().bigText(current.optString("body"))).setContentIntent(openApp(context))
                .setCategory(NotificationCompat.CATEGORY_ALARM).setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setAutoCancel(true).setTimeoutAfter(60_000L)
                .setSound(sound(context), android.media.AudioManager.STREAM_ALARM).setDefaults(NotificationCompat.DEFAULT_VIBRATE);
            // One brief ding: never starts LifeAlarmService or changes the phone's default alarm.
            NotificationManagerCompat.from(context).notify(TAG, 1, notice.build());
        }
    }
}
