import {Capacitor, registerPlugin} from '@capacitor/core';

export const isAndroidApp = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
export const LifeGoogleAuth = registerPlugin<{
  signIn(): Promise<{idToken:string}>;
  signOut(): Promise<void>;
}>('LifeGoogleAuth');

// Calendar authorization is separate from Firebase sign-in. The bridge never stores tokens.
export const LifeCalendarAuth = registerPlugin<{
  authorize(options: {email: string}): Promise<{accessToken: string}>;
  clearToken(options: {accessToken: string}): Promise<void>;
}>('LifeCalendarAuth');
