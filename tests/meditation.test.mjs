import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';

// Import the real date policy and model, preserving the project's existing local-date boundary.
const modules = new Map();
async function sourceUrl(filename) {
  if (modules.has(filename)) return modules.get(filename);
  const loading = (async () => {
    const source = (await fs.readFile(filename, 'utf8')).replace(/^import\s+['"][^'"]+\.css['"];?\s*$/gm, '');
    let compiled = ts.transpileModule(source, {
      compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, jsx: ts.JsxEmit.ReactJSX},
    }).outputText;
    for (const match of [...compiled.matchAll(/(?:from\s+|import\s*)(['"])([^'"]+)\1/g)]) {
      const specifier = match[2];
      let url;
      if (specifier.startsWith('.')) {
        const base = path.resolve(path.dirname(filename), specifier);
        let dependency;
        for (const candidate of [base, `${base}.ts`, `${base}.tsx`]) {
          try {if ((await fs.stat(candidate)).isFile()) {dependency = candidate; break;}} catch {}
        }
        assert.ok(dependency, `Falta el módulo ${specifier}`);
        url = await sourceUrl(dependency);
      } else url = import.meta.resolve(specifier);
      compiled = compiled.replace(match[0], match[0].replace(`${match[1]}${specifier}${match[1]}`, JSON.stringify(url)));
    }
    return `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
  })();
  modules.set(filename, loading);
  return loading;
}

const modelUrl = await sourceUrl(fileURLToPath(new URL('../src/lib/meditation.ts', import.meta.url)));
const {MEDITATION_HABIT_ID, isMeditationComplete, setMeditationComplete} = await import(modelUrl);
const today = '2026-10-20';
const now = new Date(2026, 9, 20, 12).getTime();
const key = date => `${date}:${MEDITATION_HABIT_ID}`;

test('meditation uses the existing daily habit boolean without creating session or duration metadata', () => {
  assert.equal(MEDITATION_HABIT_ID, 'meditation');
  const current = Object.freeze({'2026-10-20:water': true});
  const completed = setMeditationComplete(current, today, true, now);
  assert.deepEqual(completed, {'2026-10-20:water': true, '2026-10-20:meditation': true});
  assert.deepEqual(current, {'2026-10-20:water': true});
  assert.equal(isMeditationComplete(completed, today), true);
  assert.equal(isMeditationComplete(completed, '2026-10-21'), false);
  assert.equal(Object.values(completed).every(value => typeof value === 'boolean'), true);
});

test('manual registration and explicit guide completion are idempotent marks of the same day', () => {
  const manual = setMeditationComplete({}, today, true, now);
  const guided = setMeditationComplete(manual, today, true, now);
  const repeated = setMeditationComplete(guided, today, true, now);
  assert.deepEqual(manual, {[key(today)]: true});
  assert.deepEqual(guided, manual);
  assert.deepEqual(repeated, manual);
  assert.equal(Object.keys(repeated).length, 1);
  assert.equal(isMeditationComplete(repeated, today), true);
});

test('only today can register or undo meditation; historical, future and invalid dates remain closed', () => {
  const current = Object.freeze({[key('2026-10-19')]: true, [key(today)]: false, [key('2026-10-21')]: true});
  for (const date of ['2026-10-19', '2026-10-21', '2026-02-30', '2026-10-2', '', 'not-a-date']) {
    assert.deepEqual(setMeditationComplete(current, date, true, now), current, `No se puede completar ${date}`);
    assert.deepEqual(setMeditationComplete(current, date, false, now), current, `No se puede deshacer ${date}`);
  }
  assert.deepEqual(setMeditationComplete(current, today, true, NaN), current);
  assert.deepEqual(setMeditationComplete(current, today, true, new Date(NaN)), current);
});

test('undoing today preserves the marks of every other date and habit', () => {
  const current = Object.freeze({[key('2026-10-19')]: true, [key(today)]: true, [key('2026-10-21')]: false, '2026-10-20:water': true});
  const undone = setMeditationComplete(current, today, false, new Date(now));
  assert.equal(isMeditationComplete(undone, today), false);
  for (const [entry, value] of Object.entries(current)) if (entry !== key(today)) assert.equal(undone[entry], value);
  assert.equal(current[key(today)], true, 'La entrada original no se muta');
  assert.deepEqual(setMeditationComplete(undone, today, false, now), undone);
});

test('a stale guide callback cannot write to yesterday after local midnight', () => {
  const before = new Date(2026, 9, 20, 23, 59, 59);
  const after = new Date(2026, 9, 21, 0, 0, 1);
  const completed = setMeditationComplete({}, today, true, before);
  assert.equal(isMeditationComplete(completed, today), true);
  assert.deepEqual(setMeditationComplete(completed, today, false, after), completed);
  assert.deepEqual(setMeditationComplete({}, today, true, after), {});
  assert.equal(isMeditationComplete(completed, '2026-10-21'), false);
  assert.deepEqual(setMeditationComplete(completed, '2026-10-21', true, after), {[key(today)]: true, [key('2026-10-21')]: true});
});

test('default-time writes recheck Date.now rather than relying on the previously viewed day', t => {
  let clock = now;
  t.mock.method(Date, 'now', () => clock);
  const current = setMeditationComplete({}, today, true);
  assert.equal(isMeditationComplete(current, today), true);
  clock = new Date(2026, 9, 21, 0, 0, 1).getTime();
  assert.deepEqual(setMeditationComplete(current, today, false), current);
  assert.deepEqual(setMeditationComplete({}, today, true), {});
});

test('Buenos Aires midnight is local midnight even while UTC is already the following day', () => {
  const script = `
    import assert from 'node:assert/strict';
    const {setMeditationComplete,isMeditationComplete}=await import(${JSON.stringify(modelUrl)});
    const before=new Date('2026-10-21T02:59:59.000Z');
    const after=new Date('2026-10-21T03:00:01.000Z');
    const completed=setMeditationComplete({},'2026-10-20',true,before);
    assert.equal(isMeditationComplete(completed,'2026-10-20'),true);
    assert.deepEqual(setMeditationComplete(completed,'2026-10-20',false,after),completed);
    assert.equal(isMeditationComplete(completed,'2026-10-21'),false);
    assert.equal(isMeditationComplete(setMeditationComplete(completed,'2026-10-21',true,after),'2026-10-21'),true);
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env: {...process.env, TZ: 'America/Argentina/Buenos_Aires'}, encoding: 'utf8', timeout: 10_000,
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});
