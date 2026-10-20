import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const compile = path => fs.readFile(new URL(path,import.meta.url),'utf8').then(source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
const plannerUrl='data:text/javascript;base64,'+Buffer.from(await compile('../src/lib/planner.ts')).toString('base64');
const {defaults}=await import(plannerUrl);
const sleepSource=(await compile('../src/lib/sleep.ts')).replace(/from ['"]\.\/planner['"]/,`from '${plannerUrl}'`);
const {getNightPlan}=await import('data:text/javascript;base64,'+Buffer.from(sleepSource).toString('base64'));
const settings={...defaults,scheduleEnabled:true,familyConfirmed:true,preparationConfirmed:true,gymDays:[2,3,4,5,6],mondayEveningEnabled:true,mondayEveningName:'Orquesta',mondayReturnCompanion:'Compañía',cordobaConfirmed:true,sleepHours:8};

test('el domingo calcula acostarse22:45 para el despertar del lunes B06:45',()=>{
 const night=getNightPlan('2026-10-18',settings);
 assert.equal(night.wakeDate,'2026-10-19');assert.equal(night.wakeTime,405);
 assert.equal(night.bedtimeDate,'2026-10-18');assert.equal(night.bedtime,1365);
});
test('una excepción de mañana recalcula esta noche y los cambios de jardín se conservan',()=>{
 const normal=getNightPlan('2026-10-25',settings);
 const skipped=getNightPlan('2026-10-25',settings,{'2026-10-26':{skipPewen:true}});
 assert.equal(normal.wakeTime,465);assert.equal(skipped.wakeTime,450);
 assert.equal(skipped.bedtime,1410);assert.equal(skipped.bedtimeDate,'2026-10-25');
 const school=getNightPlan('2026-10-18',settings,{'2026-10-19':{skipPewen:true}});
 assert.equal(school.wakeTime,405);
});
test('medianoche corresponde al próximo día y el sueño configurado cambia el objetivo',()=>{
 const night=getNightPlan('2026-10-21',settings);
 assert.equal(night.wakeTime,480);assert.equal(night.bedtime,0);assert.equal(night.bedtimeDate,'2026-10-22');
 const longer=getNightPlan('2026-10-21',{...settings,sleepHours:9});
 assert.equal(longer.bedtime,1380);assert.equal(longer.bedtimeDate,'2026-10-21');
});

test('el lunes propone acostarse23:45 para preparar el entrenamiento del martes08:30',()=>{
 const night=getNightPlan('2026-10-19',{...settings,mealPrepTuesdayStart:'10:30'});
 assert.equal(night.wakeDate,'2026-10-20');assert.equal(night.wakeTime,465);
 assert.equal(night.bedtimeDate,'2026-10-19');assert.equal(night.bedtime,1425);
});
test('un compromiso tardío se avisa sin moverlo ni contar cuidado como impedimento para dormir',()=>{
 const night=getNightPlan('2026-10-18',settings,{},[{id:'late',title:'Ensayo tarde',date:'2026-10-18',startHHmm:'22:00',durationMin:80,travelMin:0,kind:'work'}]);
 assert(night.conflicts.some(w=>w.includes('Ensayo tarde')));
 assert(!night.conflicts.some(w=>w.includes('Tiempo con')));
 assert.equal(getNightPlan('2026-10-18',{...settings,scheduleEnabled:false}).enabled,false);
});
