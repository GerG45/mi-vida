package com.mivida.guia;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LifeRemindersPlugin.class);
        registerPlugin(LifeGoogleAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
