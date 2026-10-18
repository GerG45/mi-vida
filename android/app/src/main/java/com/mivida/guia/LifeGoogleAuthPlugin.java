package com.mivida.guia;

import android.content.MutableContextWrapper;
import android.os.CancellationSignal;
import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException;
import androidx.credentials.exceptions.NoCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

/** Native account picker. Firebase's web SDK validates/exchanges the returned ID token. */
@CapacitorPlugin(name = "LifeGoogleAuth")
public class LifeGoogleAuthPlugin extends Plugin {
    private PluginCall pendingSignIn;
    private CancellationSignal signInCancellation;

    @PluginMethod
    public void signIn(PluginCall call) {
        getActivity().runOnUiThread(() -> startSignIn(call));
    }

    private void startSignIn(PluginCall call) {
        if (pendingSignIn != null) {
            call.reject("Hay un acceso de Google pendiente. Completá o cerrá esa ventana.", "app/google-in-progress");
            return;
        }
        int resource = getContext().getResources().getIdentifier("default_web_client_id", "string", getContext().getPackageName());
        String clientId = resource == 0 ? "" : getContext().getString(resource).trim();
        if (clientId.isEmpty() || !clientId.endsWith(".apps.googleusercontent.com")) {
            call.reject("Falta configurar el acceso de Google de esta versión Android.", "app/native-google-config");
            return;
        }
        pendingSignIn = call;
        signInCancellation = new CancellationSignal();
        try {
            // This method runs only after the user presses the Google sign-in button.
            GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(clientId).build();
            GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
            CredentialManager.create(getContext()).getCredentialAsync(
                new MutableContextWrapper(getActivity()), request, signInCancellation,
                ContextCompat.getMainExecutor(getContext()),
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse result) {
                        if (pendingSignIn != call) return;
                        try {
                            Credential credential = result.getCredential();
                            if (!(credential instanceof CustomCredential) ||
                                !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                                finishError(call, "Google devolvió una credencial que Mi Vida no reconoce.", "app/native-google-credential");
                                return;
                            }
                            GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(credential.getData());
                            String idToken = google.getIdToken();
                            if (idToken.isEmpty()) {
                                finishError(call, "Google no devolvió una credencial de acceso.", "app/native-google-credential");
                                return;
                            }
                            pendingSignIn = null;
                            signInCancellation = null;
                            // Never log or persist this short-lived credential on the native side.
                            call.resolve(new JSObject().put("idToken", idToken));
                        } catch (Exception error) {
                            finishError(call, "No se pudo leer la credencial de Google. Intentá ingresar de nuevo.", "app/native-google-credential");
                        }
                    }

                    @Override
                    public void onError(GetCredentialException error) {
                        if (error instanceof GetCredentialCancellationException) {
                            finishError(call, "Cancelaste el acceso con Google.", "auth/popup-closed-by-user");
                        } else if (error instanceof NoCredentialException) {
                            finishError(call, "No se encontró una cuenta de Google disponible. Agregala en los ajustes de Android y volvé a intentar.", "app/native-google-no-account");
                        } else if (error instanceof GetCredentialProviderConfigurationException) {
                            finishError(call, "Revisá que Servicios de Google Play esté instalado y actualizado en este teléfono.", "app/native-google-provider");
                        } else {
                            finishError(call, "No se pudo completar el acceso con Google. Revisá tu conexión y volvé a intentar.", "app/native-google-failed");
                        }
                    }
                }
            );
        } catch (Exception error) {
            finishError(call, "No se pudo abrir el acceso de Google en este teléfono.", "app/native-google-failed");
        }
    }

    private void finishError(PluginCall call, String message, String code) {
        if (pendingSignIn != call) return;
        pendingSignIn = null;
        signInCancellation = null;
        call.reject(message, code);
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                CredentialManager.create(getContext()).clearCredentialStateAsync(
                    new ClearCredentialStateRequest(), null, ContextCompat.getMainExecutor(getContext()),
                    new CredentialManagerCallback<Void, ClearCredentialException>() {
                        @Override
                        public void onResult(Void unused) { call.resolve(); }

                        @Override
                        public void onError(ClearCredentialException error) {
                            call.reject("La sesión de Mi Vida se cerró, pero Google no pudo limpiar la preferencia de cuenta.", "app/native-google-signout");
                        }
                    }
                );
            } catch (Exception error) {
                call.reject("No se pudo limpiar la preferencia de cuenta de Google.", "app/native-google-signout");
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        CancellationSignal cancellation = signInCancellation;
        PluginCall call = pendingSignIn;
        pendingSignIn = null;
        signInCancellation = null;
        if (cancellation != null) cancellation.cancel();
        if (call != null) call.reject("Se cerró la pantalla de acceso. Podés volver a intentarlo.", "app/native-google-interrupted");
        super.handleOnDestroy();
    }
}
