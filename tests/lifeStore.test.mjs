import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

let instance = 0;
const trainingSource = ts.transpileModule(await fs.readFile(new URL('../src/lib/training.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const trainingUrl = `data:text/javascript;base64,${Buffer.from(trainingSource).toString('base64')}`;
const training = await import(trainingUrl);
const workSource=ts.transpileModule(await fs.readFile(new URL('../src/lib/workChecklist.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const workUrl=`data:text/javascript;base64,${Buffer.from(workSource).toString('base64')}`;
const work=await import(workUrl);
async function store() {
  const items = new Map();
  globalThis.localStorage = {getItem:key => items.get(key) ?? null,setItem:(key,value) => items.set(key,String(value)),removeItem:key => items.delete(key)};
  const source = await fs.readFile(new URL('../src/lib/lifeStore.ts',import.meta.url),'utf8');
  const {outputText} = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}});
  const code = outputText.replace(/import\s*\{\s*useSyncExternalStore\s*\}\s*from\s*['"]react['"];?/, 'const useSyncExternalStore = (_subscribe,getSnapshot) => getSnapshot();').replace(/from ['"]\.\/training['"]/,`from '${trainingUrl}'`).replace(/from ['"]\.\/workChecklist['"]/,`from '${workUrl}'`);
  const api = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${++instance}`);
  return {...api,items};
}
const settings = {childName:'tu peque',scheduleEnabled:false,gymDays:[1,3,5],schoolStart:'07:45',preparationMin:20,sleepHours:8,anchorMonday:'2026-10-12'};

test('la excepción de Pewen se guarda por fecha sin borrar el cuidado familiar',async () => {
  const s = await store();
  s.useLifeState('overrides',{});
  s.restoreLifeBackup({version:1,sections:{overrides:{'2026-10-19':{skipPewen:true,pickup:'other',care:'auto'}}}});
  assert.deepEqual(s.useLifeState('overrides',{})[0]['2026-10-19'],{skipPewen:true,pickup:'other',care:'auto'});
  assert.throws(() => s.restoreLifeBackup({version:1,sections:{overrides:{'2026-10-19':{skipPewen:'true'}}}}));
  assert.throws(() => s.restoreLifeBackup({version:1,sections:{overrides:{'2026-10-19':{unknown:true}}}}));
});

test('desayuno, equipos y enlaces privados aceptan una copia parcial y rechazan enlaces inseguros',async () => {
  const s = await store();
  const config={...settings,breakfastCreatine:false,hasBlender:false,hasHandBlender:false,homeMapsUrl:'',gymMapsUrl:'',workMapsUrl:'',mondayRehearsalMapsUrl:'',mondaySoloDeparture:'16:00',mondaySoloArrival:'17:00'};
  s.useLifeState('settings',config);
  s.restoreLifeBackup({version:1,sections:{settings:{breakfastCreatine:true,hasBlender:true,hasHandBlender:true,homeMapsUrl:'https://maps.google.com/'}}});
  const saved=s.useLifeState('settings',config)[0];
  assert.equal(saved.breakfastCreatine,true);
  assert.equal(saved.homeMapsUrl,'https://maps.google.com/');
  assert.equal(saved.schoolStart,'07:45');
  for(const changes of [{breakfastCreatine:'true'},{hasBlender:1},{homeMapsUrl:'javascript:alert(1)'},{gymMapsUrl:'http://example.com'},{workMapsUrl:'https://user:password@example.com'},{mondaySoloArrival:'29:00'}]) assert.throws(() => s.restoreLifeBackup({version:1,sections:{settings:changes}}));
});

test('diff por entrada conserva otras fechas y genera tombstones',async () => {
  const s = await store();
  const changes = s.diffSection('done',{'2026-10-18:a':true,'2026-10-19:b':false},{'2026-10-18:a':true,'2026-10-20:c':true},10);
  assert.equal(changes.length,2);
  assert.deepEqual(changes.find(record => record.key === '2026-10-19:b'),{section:'done',key:'2026-10-19:b',value:null,deleted:true,updatedAt:10});
  assert(!changes.some(record => record.key === '2026-10-18:a'));
});

test('listas se comparan por id: reordenar no reescribe ni borra',async () => {
  const s = await store(), a = {id:'a',title:'Primero'}, b = {id:'b',title:'Segundo'};
  assert.deepEqual(s.diffSection('extras',[a,b],[b,a]),[]);
  assert.equal(s.diffSection('extras',[a,b],[a])[0].key,'b');
  assert.equal(s.diffSection('extras',[a,b],[a])[0].deleted,true);
});

test('ids codifican barras, tildes y unicode sin colisiones',async () => {
  const s = await store();
  const id = s.recordId('journal','día/mañana~x');
  assert(!id.includes('/'));
  assert.deepEqual(s.decodeRecordId(id),{section:'journal',key:'día/mañana~x'});
  assert.equal(s.decodeRecordId('journal~__proto__'),null);
});

test('defaults no se escriben ni publican al iniciar sesión en otra PC',async () => {
  const s = await store();
  s.useLifeState('settings',settings);s.useLifeState('tasks',{});
  assert.equal(s.items.size,0);
  s.setStoreScope('project:userA');
  assert.deepEqual(s.getPendingRecords(),[]);
  s.receiveCloudSnapshot([]);
  assert.deepEqual(s.getPendingRecords(),[]);
  assert.equal(s.useLifeState('settings',settings)[0].childName,'tu peque');
});

test('cuentas y espacio local están aislados, incluido logout',async () => {
  const s = await store();
  let [,setSettings] = s.useLifeState('settings',settings);
  setSettings(value => ({...value,childName:'Local'}));
  s.setStoreScope('project:userA');
  assert.equal(s.useLifeState('settings',settings)[0].childName,'tu peque');
  setSettings(value => ({...value,childName:'Cuenta A'}));
  s.setStoreScope('project:userB');
  assert.equal(s.useLifeState('settings',settings)[0].childName,'tu peque');
  assert.deepEqual(s.getPendingRecords(),[]);
  s.setStoreScope('project:userA');
  assert.equal(s.useLifeState('settings',settings)[0].childName,'Cuenta A');
  assert.equal(s.getPendingRecords().length,1);
  s.setStoreScope(null);
  assert.equal(s.useLifeState('settings',settings)[0].childName,'Local');
});

test('snapshot combina remoto con cambios pendientes sin perder otra fecha',async () => {
  const s = await store();
  s.useLifeState('done',{});s.setStoreScope('project:userA');
  const [,setDone] = s.useLifeState('done',{});
  setDone({'2026-10-18:a':true});
  s.receiveCloudSnapshot([{section:'done',key:'2026-10-19:b',value:true,deleted:false,updatedAt:100}]);
  assert.deepEqual(s.useLifeState('done',{})[0],{'2026-10-18:a':true,'2026-10-19:b':true});
  const sent = s.getPendingRecords();
  setDone(value => ({...value,'2026-10-18:a':false}));
  s.acknowledgeRecords(sent);
  assert.equal(s.getPendingRecords().length,1,'un ack viejo no borra una edición más nueva');
});

test('datos parciales y campos nuevos heredan defaults sin subirlos',async () => {
  const s = await store();
  s.items.set('mi-vida:v1:settings',JSON.stringify({childName:'Nombre local'}));
  assert.deepEqual(s.useLifeState('settings',settings)[0],{...settings,childName:'Nombre local'});
  s.restoreLifeBackup({version:1,sections:{settings:{schoolStart:'08:00'}}});
  assert.equal(s.useLifeState('settings',settings)[0].childName,'Nombre local');
  assert.equal(s.useLifeState('settings',settings)[0].schoolStart,'08:00');
});

test('ajustes nuevos de ensayo y cocina aceptan respaldo anterior y validan horas y booleanos estrictos',async () => {
  const s = await store();
  const config = {...settings,mondayEveningEnabled:false,mondayEveningName:'Ensayo',mondayEveningStart:'16:30',mondayEveningEnd:'20:00',mondayEveningTravelMin:0,mondayReturnCompanion:'Compañía a confirmar',mondayReturnTravelConfirmed:false,mealPrepTuesdayStart:'',mealPrepFridayStart:''};
  s.useLifeState('settings',config);
  s.restoreLifeBackup({version:1,sections:{settings:{childName:'Mi peque'}}});
  assert.equal(s.useLifeState('settings',config)[0].mondayEveningEnabled,false);
  s.restoreLifeBackup({version:1,sections:{settings:{mondayEveningEnabled:true,mealPrepTuesdayStart:'10:30',mealPrepFridayStart:'10:30'}}});
  assert.equal(s.useLifeState('settings',config)[0].mondayEveningEnabled,true);
  assert.equal(s.useLifeState('settings',config)[0].mealPrepTuesdayStart,'10:30');
  for (const invalid of [{mondayEveningEnabled:'true'},{mondayReturnTravelConfirmed:'false'},{mondayEveningEnd:'27:00'},{mealPrepTuesdayStart:'25:10'},{mealPrepFridayStart:630}]) assert.throws(() => s.restoreLifeBackup({version:1,sections:{settings:invalid}}));
  assert.equal(s.useLifeState('settings',config)[0].mealPrepFridayStart,'10:30','un respaldo inválido conserva los datos vigentes');
  s.restoreLifeBackup({version:1,sections:{settings:{mealPrepTuesdayStart:''}}});
  assert.equal(s.useLifeState('settings',config)[0].mealPrepTuesdayStart,'','el modo automático anterior sigue disponible');
});

test('validación completa rechaza un compromiso roto sin restaurar otras secciones',async () => {
  const s = await store();
  s.useLifeState('settings',settings);s.useLifeState('extras',[]);
  assert.throws(() => s.restoreLifeBackup({version:1,sections:{settings:{childName:'No aplicar'},extras:[{id:'x',title:'Mal',date:'2026-02-31',startHHmm:'27:80',durationMin:-1,travelMin:0,kind:'work'}]}}));
  assert.equal(s.useLifeState('settings',settings)[0].childName,'tu peque');
  assert.throws(() => s.restoreLifeBackup(JSON.parse('{"version":1,"sections":{"profile":{"__proto__":{"name":"x"}}}}')));
});

test('diario, hábitos y GTD se validan profundamente y se normalizan',async () => {
  const s = await store();
  assert.throws(() => s.normalizeLifeSection('journal',{'2026-10-18':{energy:99,freeText:'x'}}));
  assert.throws(() => s.normalizeLifeSection('habits',{a:{id:'a',name:'Leer',tinyStep:42}}));
  assert.throws(() => s.normalizeLifeSection('tasks',{a:{id:'a',title:'Llamar',status:'exploded'}}));
  assert.throws(() => s.normalizeLifeSection('projects',{a:{id:'b',title:'Proyecto'}}));
  assert.equal(s.normalizeLifeSection('journal',{'2026-10-18':{freeText:'Texto'}})['2026-10-18'].energy,0);
  assert.equal(s.normalizeLifeSection('tasks',{a:{id:'a',title:'Llamar'}}).a.status,'inbox');
  assert.throws(() => s.normalizeLifeSection('done',{x:'true'}));
});

test('tombstone remoto borra una tarea y una sección nueva hidrata snapshot anterior',async () => {
  const s = await store();
  s.setStoreScope('project:userA');
  s.receiveCloudSnapshot([{section:'tasks',key:'a',value:{id:'a',title:'Acción'},deleted:false,updatedAt:1}]);
  assert.equal(s.useLifeState('tasks',{})[0].a.title,'Acción');
  s.receiveCloudSnapshot([{section:'tasks',key:'a',value:null,deleted:true,updatedAt:2}]);
  assert.deepEqual(s.useLifeState('tasks',{})[0],{});
});

test('respaldo sólo exporta secciones de la cuenta visible, sin config ni contraseña',async () => {
  const s = await store();
  s.useLifeState('profile',{name:''});
  s.items.set('mi-vida:firebase-web-config:v1','{"apiKey":"publica"}');
  s.restoreLifeBackup({version:1,sections:{profile:{name:'Mi nombre'}}});
  const backup = s.getLifeBackup();
  assert.deepEqual(Object.keys(backup.sections),['profile']);
  assert(!JSON.stringify(backup).includes('apiKey'));
  assert.equal(backup.sections.profile.name,'Mi nombre');
});

test('entrenamiento activo se respalda, sincroniza por sesión y permanece aislado por cuenta',async()=>{
  const s=await store();
  s.useLifeState('gymSessions',{});s.useLifeState('gymRoutines',{});
  const session=training.createTrainingSession({id:'sesion-1',date:'2026-10-19',week:1,day:1,now:10000});
  s.setStoreScope('project:userA');
  s.restoreLifeBackup({version:1,sections:{gymSessions:{[session.id]:session}}});
  assert.equal(s.getPendingRecords().length,1);
  assert.equal(s.getPendingRecords()[0].section,'gymSessions');
  assert.equal(s.getPendingRecords()[0].key,'sesion-1');
  assert.deepEqual(s.getLifeBackup().sections.gymSessions[session.id],session);
  s.setStoreScope('project:userB');
  assert.deepEqual(s.useLifeState('gymSessions',{})[0],{});
  assert.deepEqual(s.getPendingRecords(),[]);
  s.setStoreScope('project:userA');
  assert.equal(s.useLifeState('gymSessions',{})[0][session.id].status,'active');
  s.receiveCloudSnapshot([]);
  assert.equal(s.useLifeState('gymSessions',{})[0][session.id].status,'active','un borrador pendiente sobrevive a reconectar');
  s.restoreLifeBackup({version:1,sections:{journal:{'2026-10-19':{freeText:'Copia anterior'}}}});
  assert(s.getLifeBackup().sections.gymSessions[session.id],'una copia parcial anterior no borra el gimnasio');
});

test('sesiones inválidas rechazan el respaldo entero antes de modificar otras secciones',async()=>{
  const s=await store();s.useLifeState('profile',{name:'Actual'});s.useLifeState('gymSessions',{});
  const session=training.createTrainingSession({id:'draft',date:'2026-10-19',week:1,day:2,now:10000});
  session.exercises[0].sets[0].loadKg=-5;
  assert.throws(()=>s.restoreLifeBackup({version:1,sections:{profile:{name:'No guardar'},gymSessions:{draft:session}}}),/Sesión/);
  assert.equal(s.useLifeState('profile',{name:''})[0].name,'Actual');
  assert.deepEqual(s.useLifeState('gymSessions',{})[0],{});
  assert.equal(s.isLifeRecord({section:'gymSessions',key:'draft',value:session,deleted:false,updatedAt:10000}),false);
  assert.deepEqual(s.decodeRecordId(s.recordId('gymRoutines','mi-rutina')),{section:'gymRoutines',key:'mi-rutina'});
});

test('una sesión remota se hidrata aunque el módulo se registre después de conectar',async()=>{
  const s=await store();s.setStoreScope('project:userA');
  const session=training.createTrainingSession({id:'remote',date:'2026-10-19',week:1,day:3,now:10000});
  s.receiveCloudSnapshot([{section:'gymSessions',key:'remote',value:session,deleted:false,updatedAt:10000}]);
  assert.deepEqual(s.useLifeState('gymSessions',{})[0].remote,session);
});

test('listas de trabajo sincronizan por ítem, conservan otras fechas y generan tombstone al quitar',async()=>{
  const s=await store();s.useLifeState('workItems',{});s.setStoreScope('project:userA');
  const a=work.createWorkItem({id:'work-a',date:'2026-10-20',blockId:'flex-work-0',title:'Primer paso',now:10000});
  const b=work.createWorkItem({id:'work-b',date:'2026-10-23',blockId:'flex-work-0',title:'Para el viernes',estimatedMinutes:25,now:11000});
  s.restoreLifeBackup({version:1,sections:{workItems:{[a.id]:a,[b.id]:b}}});
  const pending=s.getPendingRecords();assert.equal(pending.length,2);
  assert(pending.every(record=>record.section==='workItems'&&!record.deleted));
  s.acknowledgeRecords(pending);
  const [,setItems]=s.useLifeState('workItems',{});
  setItems(all=>{const next={...all};delete next[a.id];return next;});
  assert.equal(s.getPendingRecords().length,1);
  assert.equal(s.getPendingRecords()[0].key,a.id);
  assert.equal(s.getPendingRecords()[0].deleted,true);
  assert.deepEqual(s.getLifeBackup().sections.workItems,{[b.id]:b});
  s.setStoreScope('project:userB');assert.deepEqual(s.useLifeState('workItems',{})[0],{});
  s.setStoreScope('project:userA');assert.deepEqual(s.useLifeState('workItems',{})[0],{[b.id]:b});
  s.restoreLifeBackup({version:1,sections:{journal:{'2026-10-20':{freeText:'Respaldo anterior'}}}});
  assert.deepEqual(s.getLifeBackup().sections.workItems,{[b.id]:b},'restaurar una copia anterior no borra las nuevas listas');
});

test('tareas de trabajo inválidas rechazan el respaldo completo sin modificar el diario',async()=>{
  const s=await store();s.useLifeState('journal',{});s.useLifeState('workItems',{});
  const item=work.createWorkItem({id:'one',date:'2026-10-20',blockId:'flex-work',title:'Un paso',now:10000});
  for(const patch of [{estimatedMinutes:-1},{done:true},{title:''},{date:'2026-02-30'},{timerStartedAt:1},{unexpected:true}]){
    const invalid={...item,...patch};
    assert.throws(()=>s.restoreLifeBackup({version:1,sections:{journal:{'2026-10-20':{freeText:'No aplicar'}},workItems:{one:invalid}}}));
  }
  assert.deepEqual(s.useLifeState('journal',{})[0],{});
  assert.deepEqual(s.useLifeState('workItems',{})[0],{});
});

test('un checklist remoto se hidrata después de conectar y mantiene su temporizador',async()=>{
  const s=await store();s.setStoreScope('project:userA');
  const item=work.startWorkItem(work.createWorkItem({id:'remote-work',date:'2026-10-20',blockId:'flex-work',title:'Concentrarme',now:10000}),20000);
  s.receiveCloudSnapshot([{section:'workItems',key:item.id,value:item,deleted:false,updatedAt:20000}]);
  const restored=s.useLifeState('workItems',{})[0][item.id];
  assert.deepEqual(restored,item);
  assert.equal(work.getWorkItemElapsed(restored,50000),30);
  s.receiveCloudSnapshot([{section:'workItems',key:item.id,value:null,deleted:true,updatedAt:30000}]);
  assert.deepEqual(s.useLifeState('workItems',{})[0],{});
});
