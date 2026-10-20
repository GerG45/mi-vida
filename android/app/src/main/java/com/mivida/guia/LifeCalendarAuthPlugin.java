package com.mivida.guia;

import android.accounts.Account;
import android.app.Activity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.ClearTokenRequest;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/** User-initiated Calendar authorization, independent of Firebase authentication. */
@CapacitorPlugin(name = "LifeCalendarAuth")
public class LifeCalendarAuthPlugin extends Plugin {
    private static final List<String> SCOPES = Arrays.asList(
        "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
        "https://www.googleapis.com/auth/calendar.events.readonly",
        "https://www.googleapis.com/auth/calendar.app.created"
    );
    private PluginCall pendingAuthorization;
    private ActivityResultLauncher<IntentSenderRequest> authorizationLauncher;

    @Override
    public void load() {
        // Capacitor's @ActivityCallback registers StartActivityForResult; a PendingIntent requires
        // Google's documented StartIntentSenderForResult contract instead.
        authorizationLauncher = bridge.registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(), result -> {
                PluginCall call = pendingAuthorization;
                if (call == null) return;
                if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
                    finishError(call, "Cancelaste la conexión con Google Calendar.", "calendar/cancelled");
                    return;
                }
                try {
                    finishAuthorization(call, Identity.getAuthorizationClient(getActivity())
                        .getAuthorizationResultFromIntent(result.getData()));
                } catch (Exception error) {
                    finishError(call, "Google no pudo completar la autorización de Calendar. Volvé a intentar.", "calendar/authorization-failed");
                }
            }
        );
    }

    @PluginMethod
    public void authorize(PluginCall call) {
        String email = call.getString("email", "").trim().toLowerCase(Locale.ROOT);
        if (email.length() > 254 || !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) {
            call.reject("Ingresá a Mi Vida con Google antes de conectar Calendar.", "calendar/account-required");
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (pendingAuthorization != null) {
                call.reject("Ya hay una autorización de Calendar abierta. Completala o cerrala.", "calendar/in-progress");
                return;
            }
            pendingAuthorization = call;
            try {
                AuthorizationRequest request = AuthorizationRequest.builder()
                    // Bind access to the Firebase account's email; never authorize an arbitrary account.
                    .setAccount(new Account(email, "com.google"))
                    .setRequestedScopes(Arrays.asList(new Scope(SCOPES.get(0)), new Scope(SCOPES.get(1)), new Scope(SCOPES.get(2))))
                    .build();
                Identity.getAuthorizationClient(getActivity()).authorize(request)
                    .addOnSuccessListener(result -> {
                        if (pendingAuthorization != call) return;
                        if (!result.hasResolution()) {finishAuthorization(call, result); return;}
                        if (result.getPendingIntent() == null) {
                            finishError(call, "Google no pudo abrir la autorización de Calendar.", "calendar/authorization-failed");
                            return;
                        }
                        try {
                            authorizationLauncher.launch(new IntentSenderRequest.Builder(result.getPendingIntent().getIntentSender()).build());
                        } catch (RuntimeException error) {
                            finishError(call, "Android no pudo abrir la autorización de Calendar.", "calendar/authorization-failed");
                        }
                    })
                    .addOnFailureListener(error -> finishError(call,
                        "No se pudo conectar Calendar. Revisá la conexión, los servicios de Google Play y la configuración de esta app en Google Cloud.",
                        "calendar/authorization-failed"));
            } catch (RuntimeException error) {
                finishError(call, "No se pudo iniciar la autorización de Calendar en este teléfono.", "calendar/authorization-failed");
            }
        });
    }

    private void finishAuthorization(PluginCall call, AuthorizationResult result) {
        if (pendingAuthorization != call) return;
        String token = result.getAccessToken();
        List<String> granted = result.getGrantedScopes();
        if (token == null || token.isEmpty() || granted == null || !granted.containsAll(SCOPES)) {
            finishError(call, "Para leer tus compromisos y publicar Mi Vida, autorizá los tres permisos de Calendar. Tu sesión de Mi Vida sigue abierta.", "calendar/scopes-required");
            return;
        }
        pendingAuthorization = null;
        // Ephemeral bridge result only: no preferences, files, logging or offline refresh token.
        call.resolve(new JSObject().put("accessToken", token));
    }

    private void finishError(PluginCall call, String message, String code) {
        if (pendingAuthorization != call) return;
        pendingAuthorization = null;
        call.reject(message, code);
    }

    @PluginMethod
    public void clearToken(PluginCall call) {
        String token = call.getString("accessToken", "");
        if (token.isEmpty() || token.length() > 16_000) {call.resolve(); return;}
        Identity.getAuthorizationClient(getActivity()).clearToken(ClearTokenRequest.builder().setToken(token).build())
            .addOnSuccessListener(unused -> call.resolve())
            .addOnFailureListener(error -> call.reject("No se pudo limpiar el acceso temporal de Calendar.", "calendar/cache-clear-failed"));
    }

    @Override
    protected void handleOnDestroy() {
        PluginCall call = pendingAuthorization;
        pendingAuthorization = null;
        if (call != null) call.reject("Se cerró la autorización de Calendar. Podés volver a conectar.", "calendar/interrupted");
        if (authorizationLauncher != null) authorizationLauncher.unregister();
        super.handleOnDestroy();
    }
}
