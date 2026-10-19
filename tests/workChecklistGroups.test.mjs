import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const data=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const workUrl=data(compile(await fs.readFile(new URL('../src/lib/workChecklist.ts',import.meta.url),'utf8')));
const work=await import(workUrl);
const source=compile(await fs.readFile(new URL('../src/lib/workChecklistGroups.ts',import.meta.url),'utf8')).replace(/from ['"]\.\/workChecklist['"]/,`from '${workUrl}'`);
const {getWorkChecklistGroups}=await import(data(source));
const event=(id,start,end,kind='work')=>({id,start,end,kind,title:'Trabajo',detail:'',fixed:false,tentative:false});
const item=(id='task',blockId='flex-work',date='2026-10-20')=>work.createWorkItem({id,date,blockId,title:'Un paso',now:10000});

test('los bloques divididos comparten lista pero sólo suman sus minutos reservados',()=>{
  const groups=getWorkChecklistGroups([event('flex-work-1',840,900),event('flex-work-0',600,660),event('meal-lunch',780,810,'meal')],{},'2026-10-20');
  assert.equal(groups.length,1);assert.equal(groups[0].id,'flex-work');
  assert.equal(groups[0].availableMinutes,120,'el intervalo entre bloques no es tiempo disponible de trabajo');
  assert.deepEqual(groups[0].events.map(e=>e.start),[600,840]);
  assert.equal(groups[0].block.start,600);assert.equal(groups[0].block.end,900);
});
test('si el bloque se quita o cambia de día se conserva la lista de su fecha sin inventar horario',()=>{
  const a=item();const b=item('future','flex-work','2026-10-23');
  const groups=getWorkChecklistGroups([],{task:a,future:b},'2026-10-20');
  assert.equal(groups.length,1);assert.equal(groups[0].id,'flex-work');
  assert.equal(groups[0].availableMinutes,0);assert.deepEqual(groups[0].events,[]);
  assert.deepEqual(getWorkChecklistGroups([],{task:a},'2026-10-21'),[]);
});
test('Pewen antes y después del almuerzo comparten lista y los ensayos no adquieren checklists',()=>{
  const groups=getWorkChecklistGroups([event('cordoba-work-am',570,780),event('cordoba-work-pm',810,930),event('monday-rehearsal',990,1200),event('saturday-rehearsal',990,1140),event('custom-project',960,990)],{},'2026-10-19');
  assert.deepEqual(groups.map(group=>group.id),['cordoba-work','custom-project']);
  assert.equal(groups[0].availableMinutes,330);
});
test('identificadores de fragmentos de una copia compatible no duplican la tarjeta de la lista',()=>{
  const legacy={...item(),blockId:'flex-work-2'};
  const groups=getWorkChecklistGroups([event('flex-work-0',600,660)],{task:legacy},'2026-10-20');
  assert.equal(groups.length,1);
  assert.equal(work.getWorkItemsForBlock({task:legacy},'2026-10-20',groups[0].id).length,1);
});
