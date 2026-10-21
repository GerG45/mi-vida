package com.mivida.guia;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class LifeTrainingTimerReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (intent == null || !intent.hasExtra("token")) return;
        try { LifeTrainingTimerScheduler.deliver(context, intent.getStringExtra("token"), intent.getLongExtra("at", 0)); }
        catch (RuntimeException error) { Log.e("MiVidaTraining", "No se pudo entregar el aviso del entrenamiento", error); }
    }
}
