import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const source = await fs.readFile(new URL('../src/lib/workChecklist.ts',import.meta.url),'utf8');
const compiled = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const work = await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const now = 1_792_420_000_000;
const fresh = (options = {}) => work.createWorkItem({id:'task-one',date:'2026-10-20',blockId:'flex-work-0',title:'Preparar el proyecto',now,...options});

test('checklists belong to the exact date and block, with stable order and no future carryover',() => {
  const a = fresh({id:'a',order:1});
  const b = fresh({id:'b',order:0});
  const otherBlock = fresh({id:'other-block',blockId:'extra-project'});
  const tomorrow = fresh({id:'tomorrow',date:'2026-10-21'});
  const items = {a,b,[otherBlock.id]:otherBlock,[tomorrow.id]:tomorrow};
  assert.deepEqual(work.getWorkItemsForBlock(items,a.date,a.blockId).map(item => item.id),['b','a']);
  assert.deepEqual(work.getWorkItemsForBlock(items,'2026-10-22',a.blockId),[]);
  assert.equal(work.getWorkChecklistSummary(items,a.date,a.blockId).total,2);
  assert.equal(items.a.order,1);
});

test('planner splits and reindexing keep the same logical work checklist without affecting custom projects',() => {
  const item = fresh({id:'project',blockId:'flex-work-0'});
  const pewen = fresh({id:'pewen',blockId:'cordoba-work-am'});
  assert.equal(item.blockId,'flex-work'); assert.equal(pewen.blockId,'cordoba-work');
  const items = {project:item,pewen};
  assert.deepEqual(work.getWorkItemsForBlock(items,item.date,'flex-work-3').map(task => task.id),['project']);
  assert.deepEqual(work.getWorkItemsForBlock(items,item.date,'cordoba-work-pm').map(task => task.id),['pewen']);
  assert.equal(work.getWorkChecklistSummary(items,item.date,'cordoba-work-am').total,1);
  assert.equal(work.getWorkChecklistBlockId({id:'extra-my-work'}),'extra-my-work');
  assert.equal(work.getWorkItemsForBlock(items,'2026-10-21','flex-work-3').length,0);
});

test('only actual work/project blocks get checklists, including custom work commitments',() => {
  for (const id of ['flex-work-0','cordoba-work','cordoba-work-am','cordoba-work-pm','extra-my-project']) {
    assert.equal(work.isWorkChecklistEvent({kind:'work',id}),true);
  }
  for (const id of ['monday-rehearsal','saturday-rehearsal']) assert.equal(work.isWorkChecklistEvent({kind:'work',id}),false);
  assert.equal(work.isWorkChecklistEvent({kind:'recording',id:'recording'}),false);
  assert.equal(work.isWorkChecklistEvent({kind:'gym',id:'gym'}),false);
});

test('optional estimates stay distinct from actual time and completion does not invent work duration',() => {
  const estimated = fresh({estimatedMinutes:30,title:'  Preparar el proyecto  '});
  assert.equal(estimated.title,'Preparar el proyecto');
  assert.equal(fresh().estimatedMinutes,null);
  const done = work.toggleWorkItem(estimated,now+3600000);
  assert.equal(done.done,true); assert.equal(done.completedAt,now+3600000);
  assert.equal(done.elapsedSeconds,0); assert.equal(done.timerStartedAt,null);
  assert.deepEqual(work.getWorkChecklistSummary({[done.id]:done},done.date,done.blockId,now+7200000),{
    total:1,completed:1,estimatedMinutes:30,elapsedSeconds:0,activeItemId:null,
  });
});

test('timestamp timer survives reload and background, pause freezes it and resume adds actual seconds',() => {
  let item = work.startWorkItem(fresh(),now);
  item = JSON.parse(JSON.stringify(item));
  assert.equal(work.getWorkItemElapsed(item,now+32000),32);
  item = work.pauseWorkItem(item,now+32000);
  assert.equal(work.getWorkItemElapsed(item,now+7200000),32);
  assert.equal(item.timerStartedAt,null);
  item = work.startWorkItem(item,now+7200000);
  assert.equal(work.getWorkItemElapsed(item,now+7215000),47);
  item = work.toggleWorkItem(item,now+7215000);
  assert.equal(item.elapsedSeconds,47); assert.equal(item.timerStartedAt,null);
  assert.equal(work.getWorkItemElapsed(item,now+9999999),47);
  assert.deepEqual(work.normalizeWorkItem(item,item.id),item);
});

test('completing pauses a timer and reopening preserves time without restarting it',() => {
  const running = work.startWorkItem(fresh(),now);
  const done = work.toggleWorkItem(running,now+61000);
  assert.equal(work.startWorkItem(done,now+120000),done);
  const reopened = work.toggleWorkItem(done,now+180000);
  assert.equal(reopened.done,false); assert.equal(reopened.completedAt,null);
  assert.equal(reopened.timerStartedAt,null); assert.equal(reopened.elapsedSeconds,61);
  assert.equal(work.getWorkItemElapsed(reopened,now+240000),61);
  assert(work.normalizeWorkItem(reopened));
});

test('starting another item pauses earlier timers across dates and blocks without changing their checks',() => {
  const first = work.startWorkItem(fresh({id:'first'}),now);
  const second = fresh({id:'second',date:'2026-10-21',blockId:'flex-work-1'});
  const before = {first,second};
  const after = work.startWorkItemTimer(before,'second',now+45000);
  assert.equal(after.first.elapsedSeconds,45); assert.equal(after.first.timerStartedAt,null);
  assert.equal(after.second.timerStartedAt,now+45000); assert.equal(after.first.done,false);
  assert.equal(before.first.timerStartedAt,now);
  assert.equal(work.startWorkItemTimer(after,'missing',now+50000),after);
  assert.equal(work.startWorkItemTimer(after,'second',now+50000),after);
});

test('strict records reject unsafe keys, invalid dates/times, mismatches and unknown fields',() => {
  const item = fresh(); assert.deepEqual(work.normalizeWorkItem(item,item.id),item);
  assert.equal(work.normalizeWorkItem(item,'another'),undefined);
  for (const patch of [
    {id:'__proto__'},{blockId:'bad/key'},{title:'  '},{title:'x'.repeat(301)},
    {date:'2026-02-30'},{date:'2026-10-2'},{estimatedMinutes:0},{estimatedMinutes:1.5},
    {estimatedMinutes:1441},{estimatedMinutes:'15'},{createdAt:Infinity},{createdAt:-1},
    {order:-1},{order:1.5},{elapsedSeconds:-1},{elapsedSeconds:0.5},
    {timerStartedAt:now-1},{timerStartedAt:NaN},{completedAt:now},{done:true},
    {done:true,completedAt:now-1},{done:true,completedAt:now,timerStartedAt:now},{uid:'private'},
  ]) assert.equal(work.normalizeWorkItem({...item,...patch}),undefined,JSON.stringify(patch));
  assert.throws(() => fresh({title:' '}));
  assert.throws(() => fresh({estimatedMinutes:-10}));
  assert(work.normalizeWorkItem(fresh({date:'2028-02-29',estimatedMinutes:1440})));
});

test('clock corrections never produce negative duration or invalid completion timestamps',() => {
  const running = work.startWorkItem(fresh(),now-10000);
  assert.equal(running.timerStartedAt,now);
  assert.equal(work.getWorkItemElapsed(running,now-30000),0);
  const done = work.toggleWorkItem(running,now-5000);
  assert.equal(done.elapsedSeconds,0); assert.equal(done.completedAt,now);
  assert(work.normalizeWorkItem(done));
  assert.equal(work.startWorkItem(fresh(),NaN).timerStartedAt,null);
});
