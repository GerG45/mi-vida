package com.mivida.guia;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.core.content.ContextCompat;
import org.json.JSONObject;

/** A small native alarm surface; stop and snooze do not depend on JavaScript or connectivity. */
public class LifeAlarmActivity extends Activity {
    private TextView title;
    private TextView body;
    private final BroadcastReceiver changes = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) { refresh(); }
    };

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
        else getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.rgb(24, 50, 42));
        getWindow().setNavigationBarColor(Color.rgb(24, 50, 42));
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(24, 50, 42));
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        int pad = dp(28);
        layout.setPadding(pad, pad + dp(24), pad, pad + dp(24));
        scroll.addView(layout, new ScrollView.LayoutParams(-1, -1));
        TextView label = text("MI VIDA · DESPERTADOR", 14, Color.rgb(207, 233, 134));
        layout.addView(label);
        title = text("Es hora de levantarte", 32, Color.WHITE);
        title.setTypeface(null, Typeface.BOLD);
        LinearLayout.LayoutParams heading = new LinearLayout.LayoutParams(-1, -2);
        heading.setMargins(0, dp(26), 0, dp(18));
        layout.addView(title, heading);
        body = text("", 18, Color.rgb(230, 236, 226));
        layout.addView(body);
        TextView note = text("Sonará hasta detener o posponer, durante un máximo de 10 minutos.", 14, Color.rgb(202, 215, 205));
        LinearLayout.LayoutParams noteParams = new LinearLayout.LayoutParams(-1, -2);
        noteParams.setMargins(0, dp(24), 0, dp(26));
        layout.addView(note, noteParams);
        Button stop = button("Detener alarma", Color.rgb(212, 237, 141), Color.rgb(24, 50, 42));
        stop.setOnClickListener(view -> { LifeAlarmService.stop(this); finish(); });
        layout.addView(stop, new LinearLayout.LayoutParams(-1, dp(64)));
        Button snooze = button("Posponer 10 minutos", Color.rgb(48, 79, 64), Color.WHITE);
        snooze.setOnClickListener(view -> {
            JSONObject active = LifeReminderScheduler.active(this);
            if (!active.has("id")) { finish(); return; }
            try { LifeReminderScheduler.snooze(this, active.optInt("id")); Toast.makeText(this, "Alarma pospuesta 10 minutos", Toast.LENGTH_SHORT).show(); finish(); }
            catch (RuntimeException error) { Toast.makeText(this, "No se pudo posponer. Revisá los permisos o tocá Detener.", Toast.LENGTH_LONG).show(); }
        });
        LinearLayout.LayoutParams snoozeParams = new LinearLayout.LayoutParams(-1, dp(64));
        snoozeParams.setMargins(0, dp(14), 0, 0);
        layout.addView(snooze, snoozeParams);
        setContentView(scroll);
        // Android 15+ lays out edge to edge. Keep native controls outside system bars.
        scroll.setOnApplyWindowInsetsListener((view, insets) -> {
            int top = insets.getSystemWindowInsetTop(), bottom = insets.getSystemWindowInsetBottom();
            view.setPadding(0, top, 0, bottom);
            return insets;
        });
        scroll.requestApplyInsets();
        ContextCompat.registerReceiver(this, changes, new IntentFilter(LifeReminderScheduler.CHANGED), ContextCompat.RECEIVER_NOT_EXPORTED);
        refresh();
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private TextView text(String value, int size, int color) {
        TextView view = new TextView(this); view.setText(value); view.setTextSize(size); view.setTextColor(color); view.setGravity(Gravity.CENTER); return view;
    }
    private Button button(String value, int background, int foreground) {
        Button button = new Button(this); button.setText(value); button.setTextSize(18); button.setAllCaps(false); button.setTextColor(foreground);
        GradientDrawable shape = new GradientDrawable(); shape.setColor(background); shape.setCornerRadius(dp(18)); button.setBackground(shape); return button;
    }
    private void refresh() {
        JSONObject active = LifeReminderScheduler.active(this);
        if (!active.has("id")) { finish(); return; }
        title.setText(active.optString("title", "Es hora de levantarte"));
        body.setText(active.optString("body"));
    }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); refresh(); }
    @Override protected void onDestroy() { unregisterReceiver(changes); super.onDestroy(); }
}
