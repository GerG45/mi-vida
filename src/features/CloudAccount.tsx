import { useEffect, useRef, useState, type FormEvent } from 'react';
import { cloudError, getCloudStatus, getFirebaseConfig, loginWithEmail, registerWithEmail, resetPassword, loginWithGoogle, logoutCloud, retryCloud, setFirebaseConfig, uploadLocalDeviceData, useCloudStatus } from '../lib/cloud';
import './cloud.css';

const labels = {local:'Guardado en este navegador',loading:'Conectando con tu cuenta…',offline:'Sin conexión · copia en este navegador',pending:'Cambios pendientes de confirmar',synced:'Sincronizado con tu cuenta',error:'La nube necesita atención'};
export function CloudAccount() {
  const status = useCloudStatus();
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [register,setRegister] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  const [json,setJson] = useState('');
  const cancelWaiting = useRef<(() => void) | null>(null);
  const config = getFirebaseConfig();
  useEffect(() => { if (status.configured) setJson(JSON.stringify(getFirebaseConfig(),null,2)); },[status.configured]);
  useEffect(() => { if (status.user) {setError('');setPassword('');} },[status.user?.uid]);
  useEffect(() => () => { cancelWaiting.current?.(); },[]);
  async function run(action: () => Promise<void>, success = '', google = false) {
    if (cancelWaiting.current) return;
    setBusy(true);setError('');setMessage('');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve,reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('Tiempo de espera agotado.'),{code:google ? 'app/google-timeout' : 'app/operation-timeout'})),60000);
      cancelWaiting.current = () => reject(Object.assign(new Error('Dejaste de esperar.'),{code:'app/wait-cancelled'}));
    });
    try { await Promise.race([action(),deadline]);setMessage(success); }
    catch (caught) { if (!google || !getCloudStatus().user) setError(cloudError(caught)); }
    finally { if (timer) clearTimeout(timer);cancelWaiting.current = null;setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault();void run(async () => { if (register) await registerWithEmail(email,password);else await loginWithEmail(email,password);setPassword(''); }); }
  return <section className="panel cloud-account" aria-labelledby="cloud-heading">
    <div className="section-title"><h2 id="cloud-heading">Tu cuenta, en todos tus dispositivos</h2><span className={`cloud-state cloud-${status.mode}`} role="status">{labels[status.mode]}</span></div>
    {!status.configured && <p className="muted">Mi Vida funciona en este navegador. Falta conectar el proyecto Firebase para ver tus cambios en otra computadora o en el celular.</p>}
    {status.user ? <>
      <p className="cloud-user">Conectado como <strong>{status.user.email || 'tu cuenta'}</strong></p>
      <p className="muted">Estás viendo los datos de esta cuenta. Al salir volvés al espacio local de este navegador.</p>
      {status.pendingCount > 0 && <p className="cloud-note">{status.pendingCount} {status.pendingCount === 1 ? 'cambio guardado' : 'cambios guardados'} en este navegador esperando confirmación de la nube.</p>}
      {status.accountEmpty && status.initialSnapshot && <div className="cloud-import"><p>Tu cuenta está vacía. Podés empezar acá o llevar a la cuenta los datos que ya guardaste en este dispositivo.</p><button type="button" className="button primary" disabled={busy || status.mode === 'offline'} onClick={() => void run(uploadLocalDeviceData,'Datos locales preparados para sincronizar. Revisá el estado de la nube para confirmar el guardado.')}>Subir datos de este dispositivo</button></div>}
      <div className="cloud-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => void run(logoutCloud,'Volviste al espacio local de este navegador.')}>Cerrar sesión</button>{status.mode === 'error' && <button type="button" className="button secondary" disabled={busy} onClick={() => void run(retryCloud)}>Reintentar conexión</button>}</div>
    </> : status.configured ? <form className="cloud-login" onSubmit={submit}>
      <p className="muted">Ingresá con la misma cuenta en cada dispositivo. La primera conexión lee tus datos guardados antes de sincronizar cambios.</p>
      {config?.emailPassword && <div className="form-grid"><label className="field"><span>Correo</span><input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="tu@correo.com"/></label><label className="field"><span>Contraseña</span><input type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={event => setPassword(event.target.value)}/></label></div>}
      <div className="cloud-actions">{config?.emailPassword && <button className="button primary" disabled={busy || status.googlePopupPending}>{busy ? 'Un momento…' : register ? 'Crear mi cuenta' : 'Ingresar'}</button>}{config && config.googleSignIn !== false && <button type="button" className={'button '+(config.emailPassword ? 'secondary' : 'primary')} disabled={busy || status.googlePopupPending} onClick={() => void run(loginWithGoogle,'',true)}>{status.googlePopupPending ? 'Esperando a Google…' : 'Ingresar con Google'}</button>}</div>
      {config?.emailPassword && <div className="cloud-links"><button type="button" disabled={busy || status.googlePopupPending || !email.trim()} onClick={() => void run(() => resetPassword(email),'Si el correo tiene una cuenta, recibirás instrucciones para restablecer la contraseña.')}>Recuperar contraseña</button>{config.allowRegistration && <button type="button" disabled={busy || status.googlePopupPending} onClick={() => {setRegister(!register);setError('');}}>{register ? 'Ya tengo cuenta' : 'Crear una cuenta'}</button>}</div>}
    </form> : null}
    {busy && <div className="cloud-actions"><button type="button" className="button secondary" onClick={() => cancelWaiting.current?.()}>Dejar de esperar</button></div>}
    {status.googlePopupPending && !busy && !status.user && <div className="cloud-note"><p>El acceso anterior sigue pendiente en este navegador. Podés seguir usando Mi Vida. Si no aparece una ventana de Google, copiá el enlace y abrilo en Chrome o Edge.</p><button type="button" className="button secondary" onClick={() => {if (!navigator.clipboard?.writeText) {setMessage('Copiá la dirección desde la barra del navegador y abrila en Chrome o Edge.');return;}void navigator.clipboard.writeText(window.location.href).then(() => setMessage('Enlace copiado. Abrilo en Chrome o Edge.'),() => setMessage('Copiá la dirección desde la barra del navegador y abrila en Chrome o Edge.'));}}>Copiar enlace de Mi Vida</button></div>}
    {(error || status.error) && <p className="cloud-error" role="alert">{error || status.error}</p>}
    {message && <p className="cloud-note" role="status">{message}</p>}
    <details className="cloud-config"><summary>Configurar conexión Firebase</summary><p className="muted">Pegá el JSON de la aplicación web de tu proyecto Mi Vida. Esta configuración es pública; las reglas de Firebase protegen tus datos.</p><label className="field"><span>Configuración web JSON</span><textarea rows={8} spellCheck={false} value={json} onChange={event => setJson(event.target.value)} placeholder={'{\n  "apiKey": "…",\n  "authDomain": "tu-proyecto.firebaseapp.com",\n  "projectId": "tu-proyecto",\n  "appId": "…"\n}'}/></label><div className="cloud-actions"><button type="button" className="button secondary" disabled={busy || status.googlePopupPending || !json.trim()} onClick={() => void run(async () => { await setFirebaseConfig(JSON.parse(json)); },'Conexión configurada. Ya podés ingresar.')}>Guardar conexión</button>{status.configured && <button type="button" className="button secondary" disabled={busy || status.googlePopupPending} onClick={() => void run(async () => {await setFirebaseConfig(null);setJson('');},'Conexión quitada de este navegador. Tus datos locales siguen disponibles.')}>Quitar configuración local</button>}</div><small>Correo y recuperación requieren emailPassword: true; el registro también allowRegistration: true. Google aparece por defecto y se puede ocultar con googleSignIn: false. Habilitá los métodos que uses en Firebase Authentication.</small></details>
  </section>;
}
export default CloudAccount;
