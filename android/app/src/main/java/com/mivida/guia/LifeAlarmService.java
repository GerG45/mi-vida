package com.mivida.guia;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import org.json.JSONException;
import org.json.JSONObject;

/** Exists only while a wake alarm is ringing; scheduling never runs a background service. */
public class LifeAlarmService extends Service {
    static final int NOTIFICATION_ID = 21044351;
    private static final long MAX_RING_MS = 600000;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private MediaPlayer player;
    private Vibrator vibrator;
    private AudioManager audio;
    private AudioFocusRequest focusRequest;
    private PowerManager.WakeLock wakeLock;
    private int alarmId = Integer.MIN_VALUE;
    private final AudioManager.OnAudioFocusChangeListener focusListener = change -> {};
    private final Runnable timeout = () -> {
        LifeReminderScheduler.error(this, "El despertador dejó de sonar después de 10 minutos sin respuesta.");
        stopSelf();
    };

    static void stop(Context context) {
        context.stopService(new Intent(context, LifeAlarmService.class));
        LifeReminderScheduler.clearActive(context);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || !intent.hasExtra("alarm")) { stopSelf(); return START_NOT_STICKY; }
        JSONObject record;
        try { record = new JSONObject(intent.getStringExtra("alarm")); }
        catch (JSONException | NullPointerException error) { stopSelf(); return START_NOT_STICKY; }
        if (!record.has("id") || !"wake".equals(record.optString("kind")) || !LifeReminderScheduler.notificationsEnabled(this)) {
            stopSelf(); return START_NOT_STICKY;
        }
        stopSound();
        alarmId = record.optInt("id");
        LifeReminderScheduler.createChannel(this);
        try {
            Notification notification = notification(record);
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            LifeReminderScheduler.setActive(this, record);
            PowerManager power = getSystemService(PowerManager.class);
            wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MiVida:WakeAlarm");
            wakeLock.acquire(MAX_RING_MS + 5000);
            playSound();
            vibrate();
            handler.postDelayed(timeout, MAX_RING_MS);
        } catch (RuntimeException error) {
            LifeReminderScheduler.error(this, "No se pudo iniciar el despertador. Revisá los permisos de Mi Vida.");
            Log.e("MiVidaAlarm", "No se pudo iniciar el despertador", error);
            try { LifeReminderScheduler.notifyReminder(this, record, true); } catch (RuntimeException ignored) {}
            stopSelf();
        }
        // Recreating a killed service must not start an unrelated or stale alarm.
        return START_NOT_STICKY;
    }

    private Notification notification(JSONObject record) {
        Intent screen = new Intent(this, LifeAlarmActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent open = PendingIntent.getActivity(this, 44001, screen, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, LifeReminderScheduler.WAKE_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_life).setContentTitle(record.optString("title"))
            .setContentText(record.optString("body"))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(record.optString("body") + "\nSonará hasta detener o posponer, durante un máximo de 10 minutos."))
            .setCategory(NotificationCompat.CATEGORY_ALARM).setPriority(NotificationCompat.PRIORITY_MAX)
            .setOngoing(true).setAutoCancel(false).setOnlyAlertOnce(true)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setContentIntent(open)
            .addAction(0, "Detener", action(record.optInt("id"), LifeAlarmActionReceiver.STOP, 44002))
            .addAction(0, "Posponer 10 min", action(record.optInt("id"), LifeAlarmActionReceiver.SNOOZE, 44003));
        if (LifeReminderScheduler.fullScreenEnabled(this)) builder.setFullScreenIntent(open, true);
        return builder.build();
    }

    private PendingIntent action(int id, String action, int code) {
        Intent intent = new Intent(this, LifeAlarmActionReceiver.class).setAction(action).putExtra("alarmId", id);
        return PendingIntent.getBroadcast(this, code, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void playSound() {
        audio = getSystemService(AudioManager.class);
        AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
        if (Build.VERSION.SDK_INT >= 26) {
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(attributes).setOnAudioFocusChangeListener(focusListener).build();
            audio.requestAudioFocus(focusRequest);
        } else audio.requestAudioFocus(focusListener, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        try {
            player = new MediaPlayer();
            player.setAudioAttributes(attributes);
            player.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
            player.setDataSource(this, sound);
            player.setLooping(true);
            player.setOnErrorListener((media, what, extra) -> {
                LifeReminderScheduler.error(this, "Android no pudo reproducir el tono. Revisá el volumen y el sonido de alarma del teléfono.");
                return true;
            });
            player.prepare();
            player.start();
            if (audio.getStreamVolume(AudioManager.STREAM_ALARM) == 0) LifeReminderScheduler.error(this, "El despertador se activó con volumen de alarmas en cero.");
        } catch (Exception error) {
            LifeReminderScheduler.error(this, "No se pudo reproducir el tono de alarma. Revisá el sonido de alarma del teléfono.");
            Log.e("MiVidaAlarm", "No se pudo reproducir el tono", error);
            if (player != null) { player.release(); player = null; }
        }
    }

    private void vibrate() {
        vibrator = getSystemService(Vibrator.class);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        long[] pattern = { 0, 500, 400, 500, 1400 };
        AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build();
        if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0), attributes);
        else vibrator.vibrate(pattern, 0, attributes);
    }

    private void stopSound() {
        handler.removeCallbacks(timeout);
        if (player != null) { try { player.stop(); } catch (RuntimeException ignored) {} player.release(); player = null; }
        if (vibrator != null) { vibrator.cancel(); vibrator = null; }
        if (audio != null) {
            if (Build.VERSION.SDK_INT >= 26 && focusRequest != null) audio.abandonAudioFocusRequest(focusRequest);
            else audio.abandonAudioFocus(focusListener);
            audio = null; focusRequest = null;
        }
        if (wakeLock != null) { if (wakeLock.isHeld()) wakeLock.release(); wakeLock = null; }
    }

    @Override public void onDestroy() {
        stopSound();
        if (LifeReminderScheduler.active(this).optInt("id", Integer.MIN_VALUE) == alarmId) LifeReminderScheduler.clearActive(this);
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
