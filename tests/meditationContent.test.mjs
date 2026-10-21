import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
async function readModule(file){
  const compiled=ts.transpileModule(await fs.readFile(new URL(file,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}
const {meditationContent:content}=await readModule('../src/lib/meditationContent.ts');
const {books,inspirations,bookQuotes,getDailyInspiration,getDailyQuote}=await readModule('../src/lib/inspiration.ts');
test('la guía de paz tiene seis pasos y distingue adaptación, sugerencia y reflexión opcional',()=>{
  assert.equal(content.steps.length,6);
  assert.equal(new Set(content.steps.map(step=>step.id)).size,6);
  assert.equal(content.sourceType,'adaptacion_no_transcripcion_literal');
  assert.equal(content.source.book,'silo-v1');
  assert.deepEqual(content.source.pdfPages,[26]);
  assert.match(content.attribution,/fragmentos 1–2/);
  assert.deepEqual(content.suggestedMinutes,[10,15]);
  assert.equal(content.optionalReflection.required,false);
  assert.equal(content.optionalReflection.storeAnswerByDefault,false);
  assert.match(content.steps[3].guidance,/sin forzar/);
  assert.match(content.steps[5].guidance,/esfera se retira/);
});
test('la rotación conserva los otros autores y cada cita e idea tiene una fuente válida',()=>{
  for(const list of [books,inspirations,bookQuotes])assert.equal(new Set(list.map(item=>item.id)).size,list.length);
  for(const id of ['monje','atomicos','riqueza','club','silo-v1','silo-v2']){
    assert(books.some(book=>book.id===id));
    assert(inspirations.some(idea=>idea.book===id));
    assert(bookQuotes.some(quote=>quote.book===id));
  }
  for(const item of [...inspirations,...bookQuotes]){
    const book=books.find(book=>book.id===item.book);
    assert(book);
    assert(item.pages.length);
    assert(item.pages.every(page=>Number.isInteger(page)&&page>0&&page<=book.pdfPages));
    if(item.book.startsWith('silo'))assert(item.sourceContext);
  }
  const quoteIds=new Set(),ideaIds=new Set();
  for(let index=0;index<Math.max(inspirations.length,bookQuotes.length);index++){
    const date=new Date(Date.UTC(2026,9,1+index)).toISOString().slice(0,10);
    quoteIds.add(getDailyQuote(date).id);ideaIds.add(getDailyInspiration(date).id);
    assert.deepEqual(getDailyQuote(date),getDailyQuote(date));
  }
  assert.equal(quoteIds.size,bookQuotes.length);assert.equal(ideaIds.size,inspirations.length);
});
