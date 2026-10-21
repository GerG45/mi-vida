import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';

// Render the actual controls, without a browser or a second copy of React.
const modules=new Map();
async function sourceUrl(filename) {
  if(modules.has(filename))return modules.get(filename);
  const loading=(async()=>{
    const source=(await fs.readFile(filename,'utf8')).replace(/^import\s+['"][^'"]+\.css['"];?\s*$/gm,'');
    let compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    for(const match of [...compiled.matchAll(/(?:from\s+|import\s*)(['"])([^'"]+)\1/g)]){
      const specifier=match[2];
      let url;
      if(specifier.startsWith('.')){
        const base=path.resolve(path.dirname(filename),specifier);
        const options=[base,`${base}.ts`,`${base}.tsx`];
        let dependency;
        for(const candidate of options){try{if((await fs.stat(candidate)).isFile()){dependency=candidate;break;}}catch{}}
        assert.ok(dependency,`Falta el módulo ${specifier}`);
        url=await sourceUrl(dependency);
      }else url=import.meta.resolve(specifier);
      compiled=compiled.replace(match[0],match[0].replace(`${match[1]}${specifier}${match[1]}`,JSON.stringify(url)));
    }
    return `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
  })();
  modules.set(filename,loading);
  return loading;
}

const {WorkChecklist}=await import(await sourceUrl(fileURLToPath(new URL('../src/features/WorkChecklist.tsx',import.meta.url))));
const {JournalView,HabitsView,emptyJournalEntry}=await import(await sourceUrl(fileURLToPath(new URL('../src/features/Journal.tsx',import.meta.url))));
const {MeditationCard}=await import(await sourceUrl(fileURLToPath(new URL('../src/features/Meditation.tsx',import.meta.url))));
const fixedNow=new Date(2026,9,19,12).getTime();
const noop=()=>{};
function render(Component,props){
  const previous=Date.now;Date.now=()=>fixedNow;
  try{return renderToStaticMarkup(React.createElement(Component,props));}finally{Date.now=previous;}
}
const tag=(html,pattern)=>html.match(pattern)?.[0]??'';
const item=date=>({id:'one',date,blockId:'flex-work',title:'Preparar propuesta',done:false,estimatedMinutes:30,createdAt:100,completedAt:null,order:0,elapsedSeconds:0,timerStartedAt:null});
const workProps=date=>({date,block:{id:'flex-work-0',kind:'work',title:'Trabajo / proyectos',start:600,end:660},items:{one:item(date)},setItems:noop,onClose:noop});

test('la meditación se puede leer en cualquier fecha pero registrar y deshacer sólo hoy',()=>{
  for(const date of ['2026-10-18','2026-10-20']){
    const pending=render(MeditationCard,{date,checks:{},setChecks:noop});
    assert.match(pending,/Leer la práctica/);
    assert.match(pending,/<button[^>]*disabled[^>]*>Ya medité/);
    const complete=render(MeditationCard,{date,checks:{[`${date}:meditation`]:true},setChecks:noop});
    assert.match(complete,/Registrada ese día/);
    assert.match(complete,/<button[^>]*disabled[^>]*>Deshacer registro/);
    assert.doesNotMatch(complete,/role="dialog"/,'La guía no se abre por explorar una fecha');
  }
  const pending=render(MeditationCard,{date:'2026-10-19',checks:{},setChecks:noop});
  assert.match(pending,/Meditar ahora/);
  assert.match(pending,/<button(?![^>]*disabled)[^>]*>Ya medité/);
  assert.match(pending,/Sin horario fijo/);
  const complete=render(MeditationCard,{date:'2026-10-19',checks:{'2026-10-19:meditation':true},setChecks:noop});
  assert.match(complete,/Realizada hoy/);
  assert.match(complete,/<button(?![^>]*disabled)[^>]*>Deshacer registro/);
});

test('listas futuras permiten preparar pasos pero sus checks y contadores quedan bloqueados',()=>{
  const html=render(WorkChecklist,workProps('2026-10-20'));
  assert.match(html,/¿Qué querés hacer\?/);
  assert.match(html,/Editar: Preparar propuesta/);
  assert.match(tag(html,/<button[^>]*role="checkbox"[^>]*>/),/disabled/);
  assert.match(tag(html,/<button[^>]*aria-label="Iniciar contador para: Preparar propuesta"[^>]*>/),/disabled/);
  assert.match(html,/Los checks y el contador se habilitan cuando llegue la fecha/);
});

test('listas pasadas se leen sin formularios, eliminación ni controles de ejecución habilitados',()=>{
  const html=render(WorkChecklist,workProps('2026-10-18'));
  assert.doesNotMatch(html,/<form/);
  assert.doesNotMatch(html,/Editar: Preparar propuesta|Más opciones para: Preparar propuesta|Deshacer eliminación/);
  assert.match(tag(html,/<button[^>]*role="checkbox"[^>]*>/),/disabled/);
  assert.match(html,/Este día ya terminó/);
  const today=render(WorkChecklist,workProps('2026-10-19'));
  assert.doesNotMatch(tag(today,/<button[^>]*role="checkbox"[^>]*>/),/disabled/);
});

test('el diario de otras fechas conserva la lectura y bloquea escritura, ánimo y energía',()=>{
  for(const selected of ['2026-10-18','2026-10-20']){
    const html=render(JournalView,{selected,onDateChange:noop,entries:{[selected]:{...emptyJournalEntry(),intention:'Quedó escrito'}},setEntries:noop});
    assert.match(html,/Quedó escrito/);
    assert.match(html,/Página de solo lectura/);
    for(const textarea of html.matchAll(/<textarea[^>]*>/g))assert.match(textarea[0],/readOnly|readonly/i);
    const selects=[...html.matchAll(/<select[^>]*>/g)].map(match=>match[0]);
    assert.equal(selects.filter(value=>/disabled/.test(value)).length,2,'ánimo y energía bloqueados, biblioteca navegable');
    assert.doesNotMatch(tag(html,/<button[^>]*aria-label="Día anterior del diario"[^>]*>/),/disabled/);
  }
  const today=render(JournalView,{selected:'2026-10-19',onDateChange:noop,entries:{},setEntries:noop});
  assert.doesNotMatch(tag(today,/<textarea[^>]*>/),/readOnly|readonly/i);
});

test('marcas de hábitos sólo se habilitan hoy y las marcas anteriores siguen visibles',()=>{
  const habit={id:'water',name:'Tomar agua',cue:'Desayuno',tinyStep:'Un vaso'};
  for(const selected of ['2026-10-18','2026-10-20']){
    const html=render(HabitsView,{selected,habits:{water:habit},setHabits:noop,checks:{[`${selected}:water`]:true},setChecks:noop});
    assert.match(tag(html,/<button[^>]*aria-pressed="true"[^>]*>/),/disabled/);
    assert.match(html,/Lo practiqué en esta fecha/);
  }
  const today=render(HabitsView,{selected:'2026-10-19',habits:{water:habit},setHabits:noop,checks:{},setChecks:noop});
  assert.doesNotMatch(tag(today,/<button[^>]*aria-pressed="false"[^>]*>/),/disabled/);
});
