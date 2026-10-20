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
const policySource=ts.transpileModule(await fs.readFile(new URL('../src/lib/datePolicy.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const policyUrl=`data:text/javascript;base64,${Buffer.from(policySource).toString('base64')}`;
const plannerSource=ts.transpileModule(await fs.readFile(new URL('../src/lib/planner.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const plannerUrl=`data:text/javascript;base64,${Buffer.from(plannerSource).toString('base64')}`;
const calendarSource=ts.transpileModule(await fs.readFile(new URL('../src/lib/calendarModel.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/from ['"]\.\/planner['"]/,`from '${plannerUrl}'`);
const calendarUrl=`data:text/javascript;base64,${Buffer.from(calendarSource).toString('base64')}`;
const calendar=await import(calendarUrl);
const grocerySource=ts.transpileModule(await fs.readFile(new URL('../src/lib/groceryList.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const groceryUrl=`data:text/javascript;base64,${Buffer.from(grocerySource).toString('base64')}`;
async function store() {
  const items = new Map();
  globalThis.localStorage = {getItem:key => items.get(key) ?? null,setItem:(key,value) => items.set(key,String(value)),removeItem:key => items.delete(key)};
  const source = await fs.readFile(new URL('../src/lib/lifeStore.ts',import.meta.url),'utf8');
  const {outputText} = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}});
  const code = outputText.replace(/import\s*\{\s*useSyncExternalStore\s*\}\s*from\s*['"]react['"];?/, 'const useSyncExternalStore = (_subscribe,getSnapshot) => getSnapshot();').replace(/from ['"]\.\/training['"]/,`from '${trainingUrl}'`).replace(/from ['"]\.\/workChecklist['"]/,`from '${workUrl}'`).replace(/from ['"]\.\/groceryList['"]/ ,`from '${groceryUrl}'`).replace(/from ['"]\.\/calendarModel['"]/ ,`from '${calendarUrl}'`).replace(/from ['"]\.\/datePolicy['"]/,`from '${policyUrl}'`);
  const api = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${++instance}`);
  return {...api,items};
}
const settings = {childName:'tu peque',scheduleEnabled:false,gymDays:[1,3,5],schoolStart:'07:45',preparationMin:20,sleepHours:8,anchorMonday:'2026-10-12'};

test('las compras de súper se guardan por cuenta y no se mezclan con la lista del meal prep',async()=>{
  const s=await store();
  const [,setGroceries]=s.useLifeState('groceries',{});
  s.useLifeState('shopping',{});
  const item={id:'bananas',name:'Bananas',quantity:'1 kg',category:'verduleria',checked:false,createdAt:100};
  s.setStoreScope('project:comprasA');
  setGroceries({bananas:item});
  assert.deepEqual(s.getLifeBackup().sections.shopping,{});
  assert(s.getPendingRecords().some(record=>record.section==='groceries'&&record.key==='bananas'));
  setGroceries(all=>({...all,bananas:{...all.bananas,checked:true}}));
  const before=s.getLifeBackup();
  assert.throws(()=>setGroceries({bananas:{...item,accessToken:'no-se-guarda'}}));
  assert.deepEqual(s.getLifeBackup().sections,before.sections);
  s.setStoreScope('project:comprasB');
  assert.deepEqual(s.getLifeBackup().sections.groceries,{});
  assert.deepEqual(s.getPendingRecords(),[]);
  s.setStoreScope('project:comprasA');
  assert.equal(s.getLifeBackup().sections.groceries.bananas.checked,true);
  assert.equal(s.getLifeBackup().sections.groceries.bananas.quantity,'1 kg');
  s.setStoreScope(null);
  assert.deepEqual(s.getLifeBackup().sections.groceries,{});
});

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

test('snapshot combina remoto con cambios pendientes sin perder otra fecha',async t => {
  t.mock.method(Date,'now',()=>new Date(2026,9,18,12).getTime());
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

test('listas de trabajo sincronizan por ítem, conservan otras fechas y generan tombstone al quitar',async t=>{
  t.mock.method(Date,'now',()=>new Date(2026,9,19,12).getTime());
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

test('el almacén bloquea checks ajenos a hoy sin escribir ni encolar y acepta los de hoy',async t=>{
  t.mock.method(Date,'now',()=>new Date(2026,9,19,12).getTime());
  const s=await store();s.useLifeState('done',{});s.setStoreScope('project:userA');
  let notifications=0;s.bindCloudWriter(()=>notifications++);
  const [,setDone]=s.useLifeState('done',{}), writes=s.items.size;
  setDone({'2026-10-18:gym':true});
  setDone({'2026-10-20:gym':true});
  setDone(all=>{all['2026-10-18:gym']=true;return all;});
  assert.deepEqual(s.useLifeState('done',{})[0],{});
  assert.equal(s.items.size,writes);
  assert.deepEqual(s.getPendingRecords(),[]);
  assert.equal(notifications,0);
  setDone({'2026-10-19:gym':true});
  assert.deepEqual(s.useLifeState('done',{})[0],{'2026-10-19:gym':true});
  assert.equal(s.getPendingRecords().length,1);
  assert.equal(notifications,1);
});

test('una mutación mixta se rechaza entera y los cambios de fechas anteriores quedan intactos',async t=>{
  t.mock.method(Date,'now',()=>new Date(2026,9,19,12).getTime());
  const s=await store();s.useLifeState('overrides',{});s.setStoreScope('project:userA');
  s.restoreLifeBackup({version:1,sections:{overrides:{'2026-10-18':{skipPewen:true}}}});
  s.acknowledgeRecords(s.getPendingRecords());
  const [,setOverrides]=s.useLifeState('overrides',{}), original=s.getLifeBackup().sections.overrides;
  setOverrides({'2026-10-18':{skipPewen:false},'2026-10-20':{skipPewen:true}});
  assert.deepEqual(s.getLifeBackup().sections.overrides,original);
  assert.deepEqual(s.getPendingRecords(),[]);
  setOverrides(all=>({...all,'2026-10-20':{skipPewen:true}}));
  assert.equal(s.getLifeBackup().sections.overrides['2026-10-20'].skipPewen,true);
});

test('un callback abierto ayer no puede guardar después de medianoche',async t=>{
  let clock=new Date(2026,9,19,23,59,59).getTime();
  t.mock.method(Date,'now',()=>clock);
  const s=await store();const [,setJournal]=s.useLifeState('journal',{});
  setJournal({'2026-10-19':{freeText:'Antes de dormir'}});
  clock=new Date(2026,9,20,0,0,1).getTime();
  setJournal(all=>({...all,'2026-10-19':{...all['2026-10-19'],freeText:'Callback atrasado'}}));
  assert.equal(s.getLifeBackup().sections.journal['2026-10-19'].freeText,'Antes de dormir');
  setJournal(all=>({...all,'2026-10-20':{freeText:'Nuevo día'}}));
  assert.equal(s.getLifeBackup().sections.journal['2026-10-20'].freeText,'Nuevo día');
});

test('la planificación de trabajo futura se guarda pero sus checks, tiempos y registros pasados se rechazan',async t=>{
  t.mock.method(Date,'now',()=>new Date(2026,9,19,12).getTime());
  const s=await store();const [,setItems]=s.useLifeState('workItems',{});
  const future=work.createWorkItem({id:'future',date:'2026-10-20',blockId:'flex-work',title:'Planear',now:10000});
  const old=work.createWorkItem({id:'old',date:'2026-10-18',blockId:'flex-work',title:'Anterior',now:10000});
  s.restoreLifeBackup({version:1,sections:{workItems:{old}}});
  setItems(all=>({...all,future}));
  setItems(all=>({...all,future:{...all.future,title:'Plan mejor',estimatedMinutes:40,order:1}}));
  assert.equal(s.getLifeBackup().sections.workItems.future.estimatedMinutes,40);
  setItems(all=>({...all,future:work.toggleWorkItem(all.future,20000)}));
  setItems(all=>({...all,future:work.startWorkItem(all.future,20000)}));
  assert.equal(s.getLifeBackup().sections.workItems.future.done,false);
  assert.equal(s.getLifeBackup().sections.workItems.future.timerStartedAt,null);
  setItems(all=>({...all,old:{...all.old,title:'No guardar'}}));
  assert.equal(s.getLifeBackup().sections.workItems.old.title,'Anterior');
});

test('un respaldo explícito y el snapshot remoto conservan históricos aunque las ediciones locales estén bloqueadas',async t=>{
  t.mock.method(Date,'now',()=>new Date(2026,9,19,12).getTime());
  const s=await store();s.useLifeState('gymSessions',{});s.useLifeState('done',{});s.setStoreScope('project:userA');
  const old=training.createTrainingSession({id:'old-gym',date:'2026-10-18',week:1,day:1,now:10000});
  s.restoreLifeBackup({version:1,sections:{gymSessions:{[old.id]:old},done:{'2026-10-18:gym':true}}});
  assert.equal(s.getPendingRecords().length,2,'restaurar una copia histórica sigue sincronizando sus registros');
  s.acknowledgeRecords(s.getPendingRecords());
  const [,setSessions]=s.useLifeState('gymSessions',{});
  setSessions(all=>({...all,[old.id]:{...all[old.id],currentExercise:1}}));
  assert.equal(s.getLifeBackup().sections.gymSessions[old.id].currentExercise,0);
  assert.deepEqual(s.getPendingRecords(),[]);
  s.receiveCloudSnapshot([{section:'gymSessions',key:old.id,value:{...old,currentExercise:2},deleted:false,updatedAt:20000},{section:'done',key:'2026-10-18:gym',value:true,deleted:false,updatedAt:20000}]);
  assert.equal(s.getLifeBackup().sections.gymSessions[old.id].currentExercise,2,'otro dispositivo puede hidratar registros históricos legítimos');
  const future=training.createTrainingSession({id:'future-gym',date:'2026-10-20',week:1,day:1,now:10000});
  setSessions(all=>({...all,[future.id]:future}));
  assert.equal(s.getLifeBackup().sections.gymSessions[future.id],undefined);
  const today=training.createTrainingSession({id:'today-gym',date:'2026-10-19',week:1,day:1,now:10000});
  setSessions(all=>({...all,[today.id]:today}));
  assert.equal(s.getLifeBackup().sections.gymSessions[today.id].date,'2026-10-19');
});

const calendarOccurrence=(id,date='2026-10-20',patch={})=>({id,date,calendarId:'personal@example.test',eventId:`remote-${id}`,title:'Compromiso externo',startMin:600,endMin:660,allDay:false,busy:true,updatedAt:1000,...patch});
const calendarLink=(id,date='2026-10-20',patch={})=>({id,date,calendarId:'managed@example.test',eventId:`published-${id}`,localHash:'local-v1',remoteHash:'remote-v1',...patch});

test('Calendar separa preferencias, snapshots y vínculos por cuenta y conserva sus colas al volver',async t=>{
  t.mock.method(Date,'now',()=>new Date(2026,9,20,12).getTime());
  const s=await store();
  const [,setPreferences]=s.useLifeState('calendarPreferences',{}),[,setEvents]=s.useLifeState('calendarEvents',{}),[,setLinks]=s.useLifeState('calendarLinks',{});
  const preferences={...calendar.defaultCalendarPreferences(),sourceCalendarIds:['personal@example.test'],destinationId:'managed@example.test'};
  s.setStoreScope('project:calendarA');
  setPreferences({main:preferences});setEvents({one:calendarOccurrence('one')});setLinks({one:calendarLink('one')});
  assert.deepEqual(s.getPendingRecords().map(record=>record.section).sort(),['calendarEvents','calendarLinks','calendarPreferences']);
  s.setStoreScope('project:calendarB');
  for(const section of ['calendarPreferences','calendarEvents','calendarLinks']) assert.deepEqual(s.useLifeState(section,{})[0],{});
  assert.deepEqual(s.getPendingRecords(),[]);
  setPreferences({main:{...calendar.defaultCalendarPreferences(),sourceCalendarIds:['other@example.test']}});
  s.setStoreScope('project:calendarA');
  assert.deepEqual(s.getLifeBackup().sections.calendarPreferences,{main:preferences});
  assert.equal(s.getLifeBackup().sections.calendarEvents.one.calendarId,'personal@example.test');
  assert.equal(s.getLifeBackup().sections.calendarLinks.one.calendarId,'managed@example.test');
  assert.equal(s.getPendingRecords().length,3);
  s.setStoreScope(null);
  for(const section of ['calendarPreferences','calendarEvents','calendarLinks']) assert.deepEqual(s.useLifeState(section,{})[0],{});
});

test('los respaldos de Calendar rechazan credenciales y campos privados antes de cambiar cualquier sección',async()=>{
  const s=await store();s.useLifeState('profile',{name:'Actual'});
  s.useLifeState('calendarPreferences',{});s.useLifeState('calendarEvents',{});s.useLifeState('calendarLinks',{});
  const preferences=calendar.defaultCalendarPreferences(), occurrence=calendarOccurrence('one'),link=calendarLink('one');
  for(const [section,key,value] of [
    ['calendarPreferences','main',{...preferences,accessToken:'never-store'}],
    ['calendarPreferences','main',{...preferences,refreshToken:'never-store'}],
    ['calendarEvents','one',{...occurrence,description:'Private notes'}],
    ['calendarEvents','one',{...occurrence,attendees:[{email:'private@example.test'}]}],
    ['calendarLinks','one',{...link,client_secret:'never-store'}],
  ]) {
    assert.throws(()=>s.restoreLifeBackup({version:1,sections:{profile:{name:'No aplicar'},[section]:{[key]:value}}}));
    assert.equal(s.getLifeBackup().sections.profile.name,'Actual');
    assert.deepEqual(s.getLifeBackup().sections[section],{});
    assert.equal(s.isLifeRecord({section,key,value,deleted:false,updatedAt:1000}),false);
  }
  s.restoreLifeBackup({version:1,sections:{calendarPreferences:{main:preferences},calendarEvents:{one:occurrence},calendarLinks:{one:link}}});
  const exported=s.getLifeBackup();
  assert.deepEqual(exported.sections.calendarEvents.one,occurrence);
  assert.doesNotMatch(JSON.stringify(exported),/accessToken|refreshToken|client_secret|Private notes|attendees/);
  s.restoreLifeBackup({version:1,sections:{profile:{name:'Copia anterior'}}});
  assert.deepEqual(s.getLifeBackup().sections.calendarEvents,exported.sections.calendarEvents,'una copia antigua no elimina las nuevas secciones');
});

test('Calendar cierra los snapshots y vínculos pasados sin permitir moverlos para esquivar el bloqueo',async t=>{
  t.mock.method(Date,'now',()=>new Date(2026,9,20,12).getTime());
  const s=await store();const [,setEvents]=s.useLifeState('calendarEvents',{}),[,setLinks]=s.useLifeState('calendarLinks',{});
  s.setStoreScope('project:calendarA');
  s.restoreLifeBackup({version:1,sections:{calendarEvents:{old:calendarOccurrence('old','2026-10-19')},calendarLinks:{old:calendarLink('old','2026-10-19')}}});
  s.acknowledgeRecords(s.getPendingRecords());
  const original=s.getLifeBackup().sections;
  setEvents(all=>({...all,old:{...all.old,title:'Cambio tardío'}}));
  setEvents(all=>({...all,old:{...all.old,date:'2026-10-21'}}));
  setEvents(all=>{all.old.title='Mutación en sitio';return all;});
  setLinks(all=>({...all,old:{...all.old,remoteHash:'late-update'}}));
  setLinks({});
  assert.deepEqual(s.getLifeBackup().sections.calendarEvents,original.calendarEvents);
  assert.deepEqual(s.getLifeBackup().sections.calendarLinks,original.calendarLinks);
  assert.deepEqual(s.getPendingRecords(),[]);
  setEvents(all=>({...all,today:calendarOccurrence('today')}));
  setLinks(all=>({...all,today:calendarLink('today')}));
  assert.equal(s.getPendingRecords().length,2);
  setEvents(all=>({...all,today:{...all.today,date:'2026-10-19'}}));
  assert.equal(s.getLifeBackup().sections.calendarEvents.today.date,'2026-10-20');
});

test('refrescar Calendar elimina sólo copias vigentes y conserva historia y fechas fuera del rango consultado',async t=>{
  t.mock.method(Date,'now',()=>new Date(2026,9,20,12).getTime());
  const s=await store();const [,setEvents]=s.useLifeState('calendarEvents',{}),[,setLinks]=s.useLifeState('calendarLinks',{});
  s.setStoreScope('project:calendarA');
  const historical=calendarOccurrence('history','2026-10-19'), stale=calendarOccurrence('stale','2026-10-20'),outside=calendarOccurrence('outside','2026-11-20');
  s.restoreLifeBackup({version:1,sections:{calendarEvents:{history:historical,stale,outside},calendarLinks:{history:calendarLink('history','2026-10-19'),stale:calendarLink('stale','2026-10-20')}}});
  s.acknowledgeRecords(s.getPendingRecords());
  const current=calendarOccurrence('fresh','2026-10-21');
  setEvents({fresh:current});
  assert.deepEqual(s.getPendingRecords(),[],'un reemplazo que borraría historia se rechaza entero');
  setEvents(all=>({...Object.fromEntries(Object.entries(all).filter(([,event])=>event.date<'2026-10-20'||event.date>'2026-11-02')),fresh:current}));
  assert.deepEqual(s.getLifeBackup().sections.calendarEvents,{history:historical,outside,fresh:current});
  const deleted=s.getPendingRecords().filter(record=>record.deleted);
  assert.deepEqual(deleted.map(record=>record.key),['stale']);
  assert(s.getPendingRecords().some(record=>record.key==='fresh'&&!record.deleted));
  assert(!s.getPendingRecords().some(record=>record.key==='history'));
  setLinks(all=>{const next={...all};delete next.stale;return next;});
  assert.deepEqual(Object.keys(s.getLifeBackup().sections.calendarLinks),['history']);
  assert(s.getPendingRecords().some(record=>record.section==='calendarLinks'&&record.key==='stale'&&record.deleted));
  s.acknowledgeRecords(s.getPendingRecords());
  s.receiveCloudSnapshot([
    {section:'calendarEvents',key:'history',value:historical,deleted:false,updatedAt:1000},
    {section:'calendarEvents',key:'outside',value:outside,deleted:false,updatedAt:1000},
    {section:'calendarEvents',key:'fresh',value:current,deleted:false,updatedAt:2000},
    {section:'calendarEvents',key:'stale',value:null,deleted:true,updatedAt:2000},
    {section:'calendarLinks',key:'history',value:calendarLink('history','2026-10-19'),deleted:false,updatedAt:1000},
  ]);
  assert.deepEqual(s.getLifeBackup().sections.calendarEvents,{history:historical,outside,fresh:current});
});
