import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import {bootstrapCloud} from './lib/cloud';
import {isAndroidApp} from './lib/native';
import {prepareLaunchCurtain, releaseLaunchCurtain} from './lib/launchCurtain';
import './styles.css';
import './wellness.css';
import './features/softMotion.css';
if (isAndroidApp()) document.documentElement.classList.add('native-android');
prepareLaunchCurtain();
function Application() {
  React.useEffect(() => { releaseLaunchCurtain(); }, []);
  return <App/>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Application/></React.StrictMode>);

void bootstrapCloud().catch(console.error);
if (!isAndroidApp() && 'serviceWorker' in navigator && import.meta.env.PROD) { window.addEventListener('load', () => { navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(console.error); }); }
