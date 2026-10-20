import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

const urls=new Map();
async function moduleUrl(name) {
  if(urls.has(name))return urls.get(name);
  let compiled=ts.transpileModule(await fs.readFile(new URL(`../src/lib/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  for(const dependency of ['planner','calendarModel'])if(compiled.includes(`'./${dependency}'`))compiled=compiled.replaceAll(`'./${dependency}'`,`'${await moduleUrl(dependency)}'`);
  const url='data:text/javascript;base64,'+Buffer.from(compiled).toString('base64');urls.set(name,url);return url;
}
const client=await import(await moduleUrl('googleCalendarClient'));
const {defaults}=await import(await moduleUrl('planner'));
const {defaultCalendarPreferences}=await import(await moduleUrl('calendarModel'));
const settings={...defaults,scheduleEnabled:true,familyConfirmed:true,preparationConfirmed:true,gymDays:[],mealPrepDays:[],flexibleWorkMin:0};
const date='2030-01-08';
const fixture=(startHHmm='11:00')=>client.buildCalendarPublishPreview({ownerEmail:'person@example.com',fromDate:date,preferences:{...defaultCalendarPreferences(),publishKinds:['personal']},settings,overrides:{},extras:[{id:'appointment',title:'Turno personal',date,startHHmm,durationMin:45,travelMin:0,kind:'personal'}],occurrences:{}});
function responses(values) {
  const calls=[];
  globalThis.fetch=async(url,options={})=>{calls.push({url:new URL(url),...options});assert.ok(values.length,`unexpected request ${url}`);const next=values.shift();return new Response(next.status===204?null:JSON.stringify(next.body),{status:next.status||200});};
  return calls;
}

test('reads all Calendar pages, expands recurring events, excludes destination and declined invitations',async()=> {
  const calls=responses([{body:{items:[{id:'one',summary:'Compromiso',start:{dateTime:`${date}T10:00:00-03:00`},end:{dateTime:`${date}T11:00:00-03:00`}}],nextPageToken:'page2'}},{body:{items:[{id:'declined',summary:'No asistiré',attendees:[{self:true,responseStatus:'declined'}],start:{dateTime:`${date}T13:00:00-03:00`},end:{dateTime:`${date}T14:00:00-03:00`}}]}}]);
  const result=await client.readGoogleCalendarOccurrences('memory-token',['source','managed'],'managed',date,date);
  assert.equal(Object.keys(result).length,1);assert.equal(Object.values(result)[0].title,'Compromiso');assert.equal(calls.length,2);
  assert.equal(calls[0].url.searchParams.get('singleEvents'),'true');assert.equal(calls[1].url.searchParams.get('pageToken'),'page2');assert.equal(calls[0].headers.Authorization,'Bearer memory-token');
  assert.ok(!JSON.stringify(result).includes('attendees'));assert.ok(!JSON.stringify(result).includes('memory-token'));
});

test('failed pagination rejects the whole read and never returns a partial snapshot',async()=> {
  responses([{body:{items:[{id:'first'}],nextPageToken:'page2'}},{status:403,body:{error:{errors:[{reason:'accessNotConfigured'}]}}}]);
  await assert.rejects(()=>client.readGoogleCalendarOccurrences('token',['source'],'',date,date),error=>error.status===403&&/habilitar Google Calendar API/.test(error.message));
});

test('snapshot replacement keeps historical entries verbatim and removes deselected future sources',()=> {
  const past={id:'past',date:'2029-12-30',calendarId:'old'},current={id:'current',date,calendarId:'source'},future={id:'future',date:'2030-02-01',calendarId:'source'},deselected={id:'old',date:'2030-02-01',calendarId:'old'};
  const merged=client.mergeCalendarSnapshot({past,current,future,deselected},{new:{id:'new',date,calendarId:'source'}},['source'],'',date,'2030-01-21');
  assert.equal(merged.past,past);assert.equal(merged.future,future);assert.ok(!merged.current);assert.ok(!merged.deselected);assert.ok(merged.new);
});

test('preview IDs stay stable across devices and time edits; published payload has no private tools or alarms',async()=> {
  const [first]=await fixture(),[again]=await fixture('11:15');assert.ok(first);assert.match(first.id,/^[a-f0-9]{65}$/);assert.equal(first.id,again.id);assert.notEqual(first.hash,again.hash);
  assert.equal(first.body.start.timeZone,'America/Argentina/Buenos_Aires');assert.deepEqual(first.body.reminders,{useDefault:false,overrides:[]});assert.ok(!first.body.attendees);assert.ok(!first.body.description);assert.ok(!first.body.location);assert.equal(first.body.summary,'Turno personal');
  assert.equal(JSON.stringify(first.body).includes('detail'),false);
});

test('a published block is idempotent, including Google omission of empty reminder overrides',async()=> {
  const [item]=await fixture();const remote={...item.body,etag:'"one"',reminders:{useDefault:false}};
  const calls=responses([{status:404,body:{}},{body:remote}]);
  const first=await client.publishMiVidaBlocks('token','managed',[item],{},date);
  assert.equal(first.created,1);assert.equal(calls[1].url.searchParams.get('sendUpdates'),'none');assert.equal(calls[1].method,'POST');
  const nextCalls=responses([{body:remote}]);const second=await client.publishMiVidaBlocks('token','managed',[item],first.links,date);
  assert.equal(second.unchanged,1);assert.equal(nextCalls.length,1);assert.equal(second.conflicts.length,0);
});

test('manual Google edits are conserved even when Mi Vida has a different desired schedule',async()=> {
  const [item]=await fixture();const remote={...item.body,summary:'Cambiado desde Google',etag:'"two"'};
  const calls=responses([{body:remote}]);const result=await client.publishMiVidaBlocks('token','managed',[item],{},date);
  assert.equal(result.conflicts.length,1);assert.equal(calls.length,1);assert.equal(result.updated,0);
});

test('an app-owned update uses If-Match and preserves a concurrent Google edit on HTTP412',async()=> {
  const [item]=await fixture();const changed={...item,body:{...item.body,summary:'Nuevo título'},hash:'different'};
  const calls=responses([{body:{...item.body,etag:'"one"'}},{status:412,body:{}}]);
  const result=await client.publishMiVidaBlocks('token','managed',[changed],{},date);
  assert.equal(calls[1].headers['If-Match'],'"one"');assert.equal(calls[1].method,'PATCH');assert.equal(result.conflicts.length,1);assert.equal(result.updated,0);
});

test('deleted blocks are not recreated silently, and obsolete remote edits are not deleted',async()=> {
  const [item]=await fixture(),link={id:item.id,date,calendarId:'managed',eventId:item.id,localHash:item.hash,remoteHash:item.hash};
  const calls=responses([{status:404,body:{}}]);const result=await client.publishMiVidaBlocks('token','managed',[item],{[link.id]:link},date);
  assert.equal(calls.length,1);assert.equal(result.conflicts.length,1);
  const deletionCalls=responses([{body:{...item.body,description:'Una nota agregada en Google',etag:'"three"'}}]);
  const deletion=await client.publishMiVidaBlocks('token','managed',[],{[link.id]:link},date);
  assert.equal(deletionCalls.length,1);assert.equal(deletion.removed,0);assert.equal(deletion.conflicts.length,1);
});

test('removing then re-including an app-owned block uses one deterministic successor without double counts',async()=> {
  const [item]=await fixture(),link={id:item.id,date,calendarId:'managed',eventId:item.id,localHash:item.hash,remoteHash:item.hash};
  const deletionCalls=responses([{body:{...item.body,etag:'"one"'}},{status:204}]);
  const removed=await client.publishMiVidaBlocks('token','managed',[],{[link.id]:link},date);
  assert.equal(removed.removed,1);assert.equal(deletionCalls[1].method,'DELETE');assert.equal(deletionCalls[1].headers['If-Match'],'"one"');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(['mi-vida-restore-v1',item.id])));
  const successor='a'+[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const remote={...item.body,id:successor,etag:'"restored"'};
  const restoreCalls=responses([{status:410,body:{}},{status:404,body:{}},{body:remote}]);
  const restored=await client.publishMiVidaBlocks('token','managed',[item],removed.links,date);
  assert.equal(restored.created,1);assert.equal(restored.updated,0);assert.equal(restored.links[item.id].eventId,successor);assert.equal(JSON.parse(restoreCalls[2].body).id,successor);
  const concurrentCalls=responses([{body:{id:item.id,status:'cancelled',etag:'"cancelled"'}},{body:remote}]);
  const concurrent=await client.publishMiVidaBlocks('token','managed',[item],removed.links,date);
  assert.equal(concurrent.unchanged,1);assert.equal(concurrent.created,0);assert.equal(concurrentCalls.length,2);assert.equal(concurrent.links[item.id].eventId,successor);
});

test('stale snapshots from deselected calendars cannot alter the export preview',async()=> {
  const [item]=await fixture();
  const preferences={...defaultCalendarPreferences(),sourceCalendarIds:[],publishKinds:['personal']};
  const stale={id:'stale',calendarId:'deselected',eventId:'remote',title:'Viejo',date,startMin:item.startMin,endMin:item.endMin,allDay:false,busy:true,updatedAt:0};
  const result=await client.buildCalendarPublishPreview({ownerEmail:'person@example.com',fromDate:date,preferences,settings,overrides:{},extras:[{id:'appointment',title:'Turno personal',date,startHHmm:'11:00',durationMin:45,travelMin:0,kind:'personal'}],occurrences:{stale}});
  assert.equal(result.length,1);assert.equal(result[0].title,'Turno personal');
});
