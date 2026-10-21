package com.mivida.guia;

import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "LifeTrainingTimers")
public class LifeTrainingTimersPlugin extends Plugin {
    @Override public void load() { restore(); }
    @Override protected void handleOnResume() { restore(); }
    private void restore() {
        try { LifeTrainingTimerScheduler.restore(getContext()); }
        catch (RuntimeException error) { Log.e("MiVidaTraining", "No se pudieron restaurar los temporizadores", error); }
    }
    private void resolve(PluginCall call) {
        try { call.resolve(JSObject.fromJSONObject(LifeTrainingTimerScheduler.status(getContext()))); }
        catch (JSONException impossible) { call.reject("No se pudo leer el estado de los avisos.", "TRAINING_STATUS_FAILED", impossible); }
    }
    @PluginMethod public void replace(PluginCall call) {
        String scope = call.getString("scope"); JSArray input = call.getArray("timers");
        if (scope == null || scope.isEmpty() || scope.length() > 500 || input == null || input.length() > LifeTrainingTimerScheduler.MAX_TIMERS) { call.reject("La cuenta y los temporizadores del entrenamiento no son válidos.", "INVALID_TRAINING_TIMERS"); return; }
        try {
            JSONArray clean = new JSONArray(); Set<String> keys = new HashSet<>();
            for (int i = 0; i < input.length(); i++) {
                JSONObject item = input.getJSONObject(i);
                String key = text(item, "key", 500), session = text(item, "sessionId", 480), date = text(item, "date", 10), kind = text(item, "kind", 4);
                Object rawAt = item.get("at"); if (!(rawAt instanceof Number)) throw new JSONException("La fecha debe ser numérica.");
                double at = ((Number) rawAt).doubleValue();
                if (!Double.isFinite(at) || at != Math.floor(at) || at <= 0 || at > 8640000000000000L || !date.matches("\\d{4}-\\d{2}-\\d{2}")
                    || (!kind.equals("rest") && !kind.equals("set")) || !key.equals(session + ":" + kind) || !keys.add(key)) throw new JSONException("Temporizador repetido o inválido.");
                clean.put(new JSONObject().put("key", key).put("sessionId", session).put("date", date).put("kind", kind).put("at", (long) at)
                    .put("title", text(item, "title", 300)).put("body", text(item, "body", 2000)));
            }
            LifeTrainingTimerScheduler.replace(getContext(), scope, clean); resolve(call);
        } catch (JSONException error) { call.reject("Temporizadores inválidos: " + error.getMessage(), "INVALID_TRAINING_TIMERS", error); }
        catch (RuntimeException error) { call.reject("Android no pudo preparar los avisos del entrenamiento. Revisá los permisos de Alarmas y recordatorios y las notificaciones.", "TRAINING_SCHEDULE_FAILED", error); }
    }
    private String text(JSONObject item, String key, int maximum) throws JSONException {
        Object raw = item.get(key); if (!(raw instanceof String) || ((String) raw).isEmpty() || ((String) raw).length() > maximum) throw new JSONException("Campo " + key + " inválido."); return (String) raw;
    }
    @PluginMethod public void cancelAll(PluginCall call) {
        try { LifeTrainingTimerScheduler.cancelAll(getContext()); resolve(call); }
        catch (RuntimeException error) { call.reject("No se pudieron cancelar los avisos del entrenamiento.", "TRAINING_CANCEL_FAILED", error); }
    }
}
