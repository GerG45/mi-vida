import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

const compile = path => fs.readFile(new URL(path,import.meta.url),'utf8').then(source => ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
const data = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const plannerUrl=data(await compile('../src/lib/planner.ts'));
const planner=await import(plannerUrl);
const model=await import(data((await compile('../src/lib/calendarModel.ts')).replace(/from ['"]\.\/planner['"]/,`from '${plannerUrl}'`)));
const sleepUrl=data((await compile('../src/lib/sleep.ts')).replace(/from ['"]\.\/planner['"]/,`from '${plannerUrl}'`));
const {getNightPlan}=await import(sleepUrl);
const alarmSource=(await compile('../src/lib/alarms.ts'))
  .replace(/import\s*\{[^}]+\}\s*from\s*['"]@capacitor\/core['"];?/, 'const Capacitor={isNativePlatform:()=>false,getPlatform:()=>"web"}; const registerPlugin=()=>({});')
  .replace(/from ['"]\.\/planner['"]/,`from '${plannerUrl}'`).replace(/from ['"]\.\/sleep['"]/,`from '${sleepUrl}'`);
const alarms=await import(data(alarmSource));
const raw=(id,start,end,patch={})=>({id,summary:'Compromiso externo',start:{dateTime:start},end:{dateTime:end},updated:'2026-10-19T12:00:00Z',...patch});
const occurrences=(rawEvents,from='2026-10-20',through=from)=>model.normalizeGoogleCalendarEvents('personal@example.test',rawEvents,from,through);
const occurrence=(patch={})=>({id:'external-one',calendarId:'personal@example.test',eventId:'one',title:'Compromiso externo',date:'2026-10-20',startMin:1020,endMin:1140,allDay:false,busy:true,updatedAt:1000,...patch});
const settings={...planner.defaults,scheduleEnabled:true,familyConfirmed:true,cordobaConfirmed:true,cordobaEndConfirmed:true,recordingConfirmed:true,preparationConfirmed:true,gymDays:[2],mealPrepDays:[],flexibleWorkMin:120};
const overrides={'2026-10-20':{care:'other',dropoff:'other',pickup:'other'}};
const overlap=(a,b)=>a.start<b.end&&b.start<a.end;

test('calendar models reject invalid snapshots, private fields, mismatched keys and invalid preferences',()=>{
  const valid=occurrence();
  assert.deepEqual(model.normalizeCalendarEventOccurrence(valid,valid.id),valid);
  for(const patch of [{date:'2026-02-30'},{startMin:1.5},{endMin:1020},{allDay:true},{updatedAt:NaN},{title:'x'.repeat(301)},{description:'Contenido privado'},{accessToken:'No debe guardarse'}]) {
    assert.equal(model.normalizeCalendarEventOccurrence({...valid,...patch}),undefined,JSON.stringify(patch));
  }
  assert.equal(model.normalizeCalendarEventOccurrence(valid,'other'),undefined);
  const prefs=model.defaultCalendarPreferences();
  assert.deepEqual(model.normalizeCalendarPreferences(prefs),prefs);
  for(const patch of [{sourceCalendarIds:['one','one']},{publishKinds:['unknown']},{destinationId:null},{includeTentative:'false'},{lastReadAt:-1},{refreshToken:'never'}]) assert.equal(model.normalizeCalendarPreferences({...prefs,...patch}),undefined);
  const link={id:'link-one',date:valid.date,calendarId:valid.calendarId,eventId:valid.eventId,localHash:'abcd',remoteHash:'efgh'};
  assert.deepEqual(model.normalizeCalendarExportLink(link,link.id),link);
  assert.equal(model.normalizeCalendarExportLink({...link,token:'never'}),undefined);
  assert.equal(model.normalizeCalendarExportLink(link,'other'),undefined);
});

test('Google snapshots keep only allowed metadata, bounded titles and identities stable across edits',()=>{
  const first=Object.values(occurrences([raw('one','2026-10-20T10:00:00-03:00','2026-10-20T11:00:00-03:00',{summary:'x'.repeat(500),description:'Secret notes',location:'Private home',attendees:[{email:'private@example.test'}]})]))[0];
  assert.equal(first.title.length,300);
  assert.deepEqual(Object.keys(first).sort(),['id','calendarId','eventId','title','date','startMin','endMin','allDay','busy','updatedAt'].sort());
  assert.equal(first.startMin,600);assert.equal(first.endMin,660);
  const changed=Object.values(occurrences([raw('one','2026-10-20T11:00:00-03:00','2026-10-20T12:00:00-03:00',{summary:'Otro nombre'})]))[0];
  assert.equal(changed.id,first.id);assert.equal(changed.startMin,660);
  assert.doesNotMatch(JSON.stringify(first),/Secret notes|Private home|private@example/);
});

test('offsets convert to Buenos Aires dates even when UTC or another offset crosses midnight',()=>{
  const rows=Object.values(occurrences([
    raw('utc','2026-10-21T01:15:00Z','2026-10-21T02:15:00Z'),
    raw('europe','2026-10-20T12:00:00+02:00','2026-10-20T12:30:00+02:00'),
  ]));
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(row=>[row.eventId,row.date,row.startMin,row.endMin]),[['utc','2026-10-20',1335,1395],['europe','2026-10-20',420,450]]);
});

test('timed events split across days and their end at midnight remains exclusive',()=>{
  const rows=Object.values(occurrences([raw('overnight','2026-10-20T23:30:00-03:00','2026-10-22T00:00:00-03:00')],'2026-10-20','2026-10-22'));
  assert.deepEqual(rows.map(row=>[row.date,row.startMin,row.endMin]),[['2026-10-20',1410,1440],['2026-10-21',0,1440]]);
  assert.notEqual(rows[0].id,rows[1].id);
  assert.equal(Object.values(occurrences([raw('ended','2026-10-19T23:00:00-03:00','2026-10-20T00:00:00-03:00')])).length,0);
});

test('all-day dates are exclusive, range-clipped and kept as informative occurrences',()=>{
  const rows=Object.values(occurrences([{id:'holiday',summary:'Día especial',start:{date:'2026-10-19'},end:{date:'2026-10-22'}}],'2026-10-20','2026-10-23'));
  assert.deepEqual(rows.map(row=>[row.date,row.startMin,row.endMin,row.allDay]),[['2026-10-20',0,1440,true],['2026-10-21',0,1440,true]]);
  const events=model.getCalendarBusyEvents(rows,'2026-10-20');
  assert.equal(events.length,1);assert.equal(events[0].busy,false);assert.equal(events[0].allDay,true);assert.equal(events[0].source,'google');
});

test('cancelled and malformed events are omitted; transparent events do not claim busy time',()=>{
  const rows=Object.values(occurrences([
    raw('cancelled','2026-10-20T10:00:00Z','2026-10-20T11:00:00Z',{status:'cancelled'}),
    raw('wrong-day','2026-02-30T10:00:00Z','2026-03-01T11:00:00Z'),
    raw('reversed','2026-10-20T11:00:00Z','2026-10-20T10:00:00Z'),
    raw('transparent','2026-10-20T10:00:00Z','2026-10-20T11:00:00Z',{transparency:'transparent'}),
  ]));
  assert.equal(rows.length,1);assert.equal(rows[0].eventId,'transparent');assert.equal(rows[0].busy,false);
});

test('floating wall times require a valid explicit timezone and never use the device timezone',()=>{
  const events=[{id:'floating',start:{dateTime:'2026-10-20T12:00:00',timeZone:'Europe/Paris'},end:{dateTime:'2026-10-20T13:00:00',timeZone:'Europe/Paris'}}];
  const previous=process.env.TZ;
  try {
    process.env.TZ='Pacific/Auckland';const east=occurrences(events);
    process.env.TZ='America/Los_Angeles';const west=occurrences(events);
    assert.deepEqual(east,west);assert.equal(Object.values(east)[0].startMin,420);
    assert.deepEqual(occurrences([{id:'ambiguous',start:{dateTime:'2026-10-20T12:00:00'},end:{dateTime:'2026-10-20T13:00:00'}}]),{});
    assert.deepEqual(occurrences([{...events[0],start:{dateTime:'2026-10-20T12:00:00',timeZone:'Invalid/Timezone'}}]),{});
  } finally {if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});

test('snapshot ranges are validated and bounded to fourteen dates',()=>{
  const spanning={id:'long',start:{date:'2026-10-01'},end:{date:'2026-12-01'}};
  assert.equal(Object.keys(occurrences([spanning],'2026-10-20','2026-11-02')).length,14);
  for(const [from,to] of [['2026-10-20','2026-11-03'],['2026-10-21','2026-10-20'],['2026-02-30','2026-03-02']]) assert.deepEqual(occurrences([spanning],from,to),{});
});

test('busy Google commitments reserve room before scheduling gym and flexible project work',()=>{
  const imported=occurrence({startMin:480,endMin:600});
  const normal=planner.buildDay(imported.date,settings,overrides);
  const connected=planner.buildDay(imported.date,settings,overrides,[],[imported]);
  assert(normal.events.some(event=>event.id==='gym'));
  const external=connected.events.find(event=>event.source==='google');
  assert.equal(external.start,480);assert.equal(external.end,600);
  for(const event of connected.events.filter(event=>event.id==='gym'||event.id.startsWith('gym-')||event.id.startsWith('flex-work-'))) assert.equal(overlap(event,external),false,event.id);
  assert.notEqual(connected.events.find(event=>event.id==='gym')?.start,normal.events.find(event=>event.id==='gym')?.start);
});

test('all-day and transparent events remain visible without changing normal placement or wake time',()=>{
  const normal=planner.buildDay('2026-10-20',settings,overrides);
  const connected=planner.buildDay('2026-10-20',settings,overrides,[],[occurrence({id:'all-day',allDay:true,startMin:0,endMin:1440}),occurrence({id:'available',busy:false,startMin:60,endMin:1430})]);
  assert.equal(connected.wakeTime,normal.wakeTime);
  assert.deepEqual(connected.events.filter(event=>event.source!=='google'),normal.events);
  assert.deepEqual(connected.warnings,normal.warnings);
  assert.equal(connected.events.filter(event=>event.source==='google').length,2);
});

test('external early commitments update the next wake-up and previous bedtime, not local records',()=>{
  const imported=occurrence({startMin:360,endMin:420});const before=structuredClone(imported);
  const plan=planner.buildDay(imported.date,settings,overrides,[],[imported]);
  assert.equal(plan.wakeTime,330);
  const night=getNightPlan('2026-10-19',settings,overrides,[],[imported]);
  assert.equal(night.wakeTime,330);assert.equal(night.bedtimeDate,'2026-10-19');assert.equal(night.bedtime,1290);
  assert.deepEqual(imported,before);
});

test('late busy imports create sleep conflict warnings, informative imports do not',()=>{
  const evening=occurrence({date:'2026-10-19',startMin:1380,endMin:1440});
  const tomorrow=occurrence({id:'tomorrow',startMin:360,endMin:420});
  assert(getNightPlan(evening.date,settings,overrides,[],[evening,tomorrow]).conflicts.some(message=>message.includes(evening.title)));
  assert(!getNightPlan(evening.date,settings,overrides,[],[{...evening,busy:false},tomorrow]).conflicts.some(message=>message.includes(evening.title)));
});

test('native wake alarms use external commitments but do not duplicate Google event reminders',()=>{
  const imported=occurrence({startMin:360,endMin:420});
  const now=new Date(2026,9,20,0,0).getTime();
  const preferences={...alarms.defaultAlarmPreferences(),wake:true,agenda:true};
  const batch=alarms.buildAlarmBatch({settings,overrides,preferences,now,externalOccurrences:[imported]});
  assert.equal(batch.preview.find(alarm=>alarm.key==='wake:2026-10-20').at,new Date(2026,9,20,5,30).getTime());
  assert(!batch.preview.some(alarm=>alarm.key.includes('google-')));
  assert(batch.preview.some(alarm=>alarm.source==='agenda'));
});

test('calendar imports do not activate the personal schedule and duplicate snapshots are displayed once',()=>{
  const external=occurrence();
  const day=planner.buildDay(external.date,{...planner.defaults}, {}, [], [external,external]);
  assert.equal(day.events.length,1);assert.equal(day.events[0].source,'google');
  assert(day.pending.some(message=>message.includes('activá tu agenda')));
  assert(!day.events.some(event=>event.id==='gym'||event.id==='meal-breakfast'));
});
