package com.mivida.guia;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.app.AlarmManager;
import android.util.Log;

public class LifeReminderBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
            && !Intent.ACTION_TIME_CHANGED.equals(action) && !Intent.ACTION_TIMEZONE_CHANGED.equals(action)
            && !AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED.equals(action)) return;
        try {
            // Boot restores only future AlarmManager entries; it never starts audio playback.
            LifeReminderScheduler.restore(context);
        } catch (RuntimeException error) {
            LifeReminderScheduler.error(context, "No se pudieron restaurar las alarmas. Abrí Mi Vida y revisá los permisos.");
            Log.e("MiVidaReminders", "No se pudieron restaurar los recordatorios", error);
        }
    }
}
