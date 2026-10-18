package com.mivida.guia;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Saves only the document chosen by the user; no broad storage permission. */
@CapacitorPlugin(name = "TextExport")
public class TextExportPlugin extends Plugin {
    private PluginCall pendingExport;

    @PluginMethod
    public void saveTextFile(PluginCall call) {
        String filename = call.getString("filename", "").trim();
        String content = call.getString("content");
        String mimeType = call.getString("mimeType", "text/markdown").split(";", 2)[0].trim();
        if (filename.isEmpty() || filename.length() > 150 || filename.matches(".*[\\\\/\\p{Cntrl}].*") || content == null || content.length() > 10_000_000 || !mimeType.matches("[A-Za-z0-9!#$&^_.+-]+/[A-Za-z0-9!#$&^_.+-]+")) {
            call.reject("No se pudo preparar un documento de texto válido.", "EXPORT_INVALID");
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (pendingExport != null) {
                call.reject("Terminá de guardar o cancelá el documento anterior.", "EXPORT_IN_PROGRESS");
                return;
            }
            pendingExport = call;
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType(mimeType)
                .putExtra(Intent.EXTRA_TITLE, filename);
            try {
                startActivityForResult(call, intent, "documentCreated");
            } catch (RuntimeException error) {
                pendingExport = null;
                call.reject("Android no pudo abrir la ventana para guardar el archivo.", "EXPORT_PICKER_FAILED", error);
            }
        });
    }

    @ActivityCallback
    private void documentCreated(PluginCall call, ActivityResult result) {
        if (call == null) { pendingExport = null; return; }
        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            pendingExport = null;
            call.resolve(new JSObject().put("saved", false));
            return;
        }
        Intent data = result.getData();
        Uri uri = data == null ? null : data.getData();
        String content = call.getString("content");
        if (result.getResultCode() != Activity.RESULT_OK || uri == null || content == null) {
            pendingExport = null;
            call.reject("Android no devolvió un archivo donde guardar el reporte.", "EXPORT_DOCUMENT_MISSING");
            return;
        }
        // A provider may write to disk or the user's chosen cloud drive. Do not block the UI.
        execute(() -> {
            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (output == null) throw new IOException("No output stream");
                output.write(content.getBytes(StandardCharsets.UTF_8));
            } catch (IOException | RuntimeException error) {
                getActivity().runOnUiThread(() -> {
                    if (pendingExport != call) return;
                    pendingExport = null;
                    call.reject("No se pudo guardar el reporte en ese lugar. Elegí otra carpeta e intentá de nuevo.", "EXPORT_WRITE_FAILED", error);
                });
                return;
            }
            // Resolve only after the provider closed the document successfully.
            getActivity().runOnUiThread(() -> {
                if (pendingExport != call) return;
                pendingExport = null;
                call.resolve(new JSObject().put("saved", true));
            });
        });
    }

    @Override
    protected void handleOnDestroy() {
        PluginCall call = pendingExport;
        pendingExport = null;
        if (call != null) call.reject("Se cerró la pantalla antes de terminar la exportación. Volvé a intentarlo.", "EXPORT_INTERRUPTED");
        super.handleOnDestroy();
    }
}
