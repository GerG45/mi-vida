import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

let instance = 0;
async function store() {
  const items = new Map();
  globalThis.localStorage = {getItem:key => items.get(key) ?? null,setItem:(key,value) => items.set(key,String(value)),removeItem:key => items.delete(key)};
  const source = await fs.readFile(new URL('../src/lib/lifeStore.ts',import.meta.url),'utf8');
  const {outputText} = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}});
  const code = outputText.replace(/import\s*\{\s*useSyncExternalStore\s*\}\s*from\s*['"]react['"];?/, 'const useSyncExternalStore = (_subscribe,getSnapshot) => getSnapshot();');
  const api = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}#${++instance}`);
  return {...api,items};
}
const settings = {childName:'tu peque',scheduleEnabled:false,gymDays:[1,3,5],schoolStart:'07:45',preparationMin:20,sleepHours:8,anchorMonday:'2026-10-12'};

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
