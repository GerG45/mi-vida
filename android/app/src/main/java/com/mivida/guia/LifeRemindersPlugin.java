package com.mivida.guia;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "LifeReminders", permissions = @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }))
public class LifeRemindersPlugin extends Plugin {
    @Override public void load() { restore(); }
    @Override protected void handleOnResume() { restore(); }
    private void restore() {
        try { LifeReminderScheduler.restore(getContext()); }
        catch (RuntimeException error) {
            LifeReminderScheduler.error(getContext(), "No se pudieron restaurar las alarmas. Revisá los permisos y actualizá la agenda.");
            Log.e("MiVidaReminders", "No se pudieron restaurar las alarmas", error);
        }
    }

    @PluginMethod public void permissionStatus(PluginCall call) { call.resolve(status()); }
    @PluginMethod public void requestPermission(PluginCall call) {
        LifeReminderScheduler.createChannel(getContext());
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationPermissionResult");
        } else call.resolve(status());
    }
    @PermissionCallback private void notificationPermissionResult(PluginCall call) { restore(); call.resolve(status()); }

    private JSObject status() {
        boolean notifications = LifeReminderScheduler.notificationsEnabled(getContext());
        boolean exact = LifeReminderScheduler.exactAlarmsEnabled(getContext());
        JSONArray stored = LifeReminderScheduler.read(getContext());
        long next = Long.MAX_VALUE, now = System.currentTimeMillis();
        int future = 0;
        for (int i = 0; i < stored.length(); i++) {
            JSONObject record = stored.optJSONObject(i);
            if (record != null && record.optLong("at") > now) { future++; next = Math.min(next, record.optLong("at")); }
        }
        AudioManager audio = getContext().getSystemService(AudioManager.class);
        JSObject result = new JSObject();
        result.put("granted", notifications && exact);
        result.put("notifications", notifications);
        result.put("exactAlarms", exact);
        result.put("fullScreen", LifeReminderScheduler.fullScreenEnabled(getContext()));
        result.put("alarmVolume", audio.getStreamVolume(AudioManager.STREAM_ALARM));
        result.put("alarmMaxVolume", audio.getStreamMaxVolume(AudioManager.STREAM_ALARM));
        result.put("pending", notifications && exact && LifeReminderScheduler.isArmed(getContext()) ? future : 0);
        result.put("stored", future);
        result.put("nextAt", future > 0 ? next : JSONObject.NULL);
        result.put("lastError", LifeReminderScheduler.lastError(getContext()) == null ? JSONObject.NULL : LifeReminderScheduler.lastError(getContext()));
        return result;
    }

    @PluginMethod public void openExactAlarmSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < 31 || LifeReminderScheduler.exactAlarmsEnabled(getContext())) { call.resolve(status()); return; }
        openSettings(call, new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getContext().getPackageName())));
    }
    @PluginMethod public void openFullScreenSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < 34 || LifeReminderScheduler.fullScreenEnabled(getContext())) { call.resolve(status()); return; }
        openSettings(call, new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + getContext().getPackageName())));
    }
    @PluginMethod public void openNotificationSettings(PluginCall call) {
        openSettings(call, new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName()));
    }
    @PluginMethod public void openAlarmSettings(PluginCall call) { openSettings(call, new Intent(Settings.ACTION_SOUND_SETTINGS)); }
    private void openSettings(PluginCall call, Intent intent) {
        try {
            getActivity().startActivity(intent);
            // Opening Android settings is not a permission grant.
            JSObject result = status(); result.put("opened", true); call.resolve(result);
        } catch (RuntimeException error) { call.reject("No se pudo abrir Ajustes de Android. Buscá Mi Vida en Ajustes → Aplicaciones.", "SETTINGS_UNAVAILABLE", error); }
    }

    @PluginMethod public void schedule(PluginCall call) {
        if (!LifeReminderScheduler.notificationsEnabled(getContext())) { call.reject("Activá las notificaciones y los canales Despertador y Recordatorios puntuales de Mi Vida.", "NOTIFICATIONS_DISABLED"); return; }
        if (!LifeReminderScheduler.exactAlarmsEnabled(getContext())) { call.reject("Activá Alarmas y recordatorios en los ajustes de Android antes de programar.", "EXACT_ALARMS_DISABLED"); return; }
        JSArray input = call.getArray("notifications");
        if (input == null || input.length() > LifeReminderScheduler.MAX_RECORDS) { call.reject("Enviá notifications con un máximo de 200 alarmas futuras.", "INVALID_NOTIFICATIONS"); return; }
        try {
            JSONArray clean = new JSONArray();
            Set<Integer> ids = new HashSet<>();
            long now = System.currentTimeMillis();
            for (int i = 0; i < input.length(); i++) {
                JSONObject item = input.getJSONObject(i);
                Object rawId = item.get("id"), rawAt = item.get("at"), rawTitle = item.get("title"), rawBody = item.get("body");
                if (!(rawId instanceof Number) || !(rawAt instanceof Number)) throw new JSONException("id y at deben ser números.");
                double id = ((Number) rawId).doubleValue(), at = ((Number) rawAt).doubleValue();
                if (!Double.isFinite(id) || id != Math.floor(id) || id < 0 || id > Integer.MAX_VALUE) throw new JSONException("Cada id debe ser un entero positivo o cero.");
                if (!Double.isFinite(at) || at != Math.floor(at) || at <= now + 1000 || at > 8640000000000000L) throw new JSONException("Cada at debe ser una fecha futura en milisegundos, al menos un segundo después de ahora.");
                if (!ids.add((int) id)) throw new JSONException("Los ids no pueden repetirse.");
                if (!(rawTitle instanceof String) || !(rawBody instanceof String) || ((String) rawTitle).trim().isEmpty()) throw new JSONException("Cada alarma requiere title y body de texto.");
                String title = ((String) rawTitle).trim(), body = (String) rawBody, kind = item.optString("kind", "reminder");
                if (title.length() > 300 || body.length() > 2000 || (!kind.equals("wake") && !kind.equals("reminder"))) throw new JSONException("Título máximo 300, detalle máximo 2000 y kind wake o reminder.");
                clean.put(new JSONObject().put("id", (int) id).put("at", (long) at).put("title", title).put("body", body).put("kind", kind));
            }
            LifeReminderScheduler.replace(getContext(), clean);
            JSObject result = status(); result.put("scheduled", clean.length()); call.resolve(result);
        } catch (JSONException error) { call.reject("Alarmas inválidas: " + error.getMessage(), "INVALID_NOTIFICATIONS"); }
        catch (RuntimeException error) { call.reject("Android no pudo programar las alarmas. Revisá los permisos e intentá de nuevo.", "SCHEDULE_FAILED", error); }
    }
    @PluginMethod public void testAlarm(PluginCall call) {
        try {
            long at = LifeReminderScheduler.test(getContext());
            JSObject result = status(); result.put("testAt", at); call.resolve(result);
        } catch (RuntimeException error) { call.reject("La prueba necesita notificaciones y alarmas exactas activadas.", "TEST_FAILED", error); }
    }
    @PluginMethod public void cancelAll(PluginCall call) {
        try { LifeReminderScheduler.cancelAll(getContext()); call.resolve(status()); }
        catch (RuntimeException error) { call.reject("No se pudieron cancelar las alarmas. Intentá de nuevo.", "CANCEL_FAILED", error); }
    }
}
