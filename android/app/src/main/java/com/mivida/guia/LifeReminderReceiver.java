package com.mivida.guia;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class LifeReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !intent.hasExtra("reminderId")) return;
        try {
            LifeReminderScheduler.deliver(context, intent.getIntExtra("reminderId", -1), intent.getLongExtra("reminderAt", 0));
        } catch (RuntimeException error) {
            LifeReminderScheduler.error(context, "Android no pudo entregar una alarma. Revisá los permisos y la hora del teléfono.");
            Log.e("MiVidaReminders", "No se pudo mostrar un recordatorio", error);
        }
    }
}
