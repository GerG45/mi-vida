import {Capacitor, registerPlugin} from '@capacitor/core';

export const isAndroidApp = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
export const LifeGoogleAuth = registerPlugin<{
  signIn(): Promise<{idToken:string}>;
  signOut(): Promise<void>;
}>('LifeGoogleAuth');
