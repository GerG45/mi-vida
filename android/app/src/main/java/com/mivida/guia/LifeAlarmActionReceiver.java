package com.mivida.guia;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import android.widget.Toast;
import org.json.JSONObject;

public class LifeAlarmActionReceiver extends BroadcastReceiver {
    static final String STOP = "com.mivida.guia.STOP_ALARM";
    static final String SNOOZE = "com.mivida.guia.SNOOZE_ALARM";
    @Override public void onReceive(Context context, Intent intent) {
        if (intent == null || !intent.hasExtra("alarmId")) return;
        JSONObject active = LifeReminderScheduler.active(context);
        if (!active.has("id") || active.optInt("id") != intent.getIntExtra("alarmId", Integer.MIN_VALUE)) return;
        try {
            if (STOP.equals(intent.getAction())) LifeAlarmService.stop(context);
            else if (SNOOZE.equals(intent.getAction())) LifeReminderScheduler.snooze(context, active.optInt("id"));
        } catch (RuntimeException error) {
            LifeReminderScheduler.error(context, "No se pudo posponer. La alarma continúa hasta que la detengas.");
            Toast.makeText(context, "No se pudo posponer. Revisá los permisos o tocá Detener.", Toast.LENGTH_LONG).show();
            Log.e("MiVidaAlarm", "No se pudo posponer", error);
        }
    }
}
