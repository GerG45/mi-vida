import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

async function loadModule(relativePath) {
  const source = await fs.readFile(new URL(relativePath, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022},
  }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
}

const [gym, media] = await Promise.all([
  loadModule('../src/lib/training.ts'),
  loadModule('../src/lib/trainingMedia.ts'),
]);

test('every exercise and equipment variant has its own concrete tutorial and offline illustration', async () => {
  assert.deepEqual(Object.keys(media.TRAINING_MEDIA).sort(), gym.TRAINING_EXERCISES.map(exercise => exercise.id).sort());
  for (const exercise of gym.TRAINING_EXERCISES) {
    const group = media.getTrainingMedia(exercise.id);
    assert.deepEqual(group.tutorials.map(tutorial => tutorial.id).sort(), exercise.variants.map(variant => variant.id).sort(), exercise.name);
    assert.equal(media.getTrainingMedia(`w4-${exercise.id}`), group);
    for (const variant of exercise.variants) {
      const tutorial = media.getTrainingTutorial(exercise.id, variant.id);
      assert.equal(tutorial.label, variant.name);
      assert.match(tutorial.videoId, /^[a-zA-Z0-9_-]{11}$/);
      const videoUrl = new URL(tutorial.url);
      assert.equal(videoUrl.protocol, 'https:');
      assert.equal(videoUrl.hostname, 'www.youtube.com');
      assert.equal(videoUrl.pathname, '/watch');
      assert.equal(videoUrl.searchParams.get('v'), tutorial.videoId);
      const thumbnail = new URL(tutorial.thumbnail);
      assert.equal(thumbnail.protocol, 'https:');
      assert.equal(thumbnail.hostname, 'i.ytimg.com');
      assert.ok(thumbnail.pathname.includes(`/${tutorial.videoId}/`));
      assert.ok(tutorial.title.trim() && tutorial.channel.trim());
      assert.ok(['es', 'en'].includes(tutorial.language));
      assert.equal(media.getTrainingIllustration(exercise.id, variant.id), tutorial.illustration);
      assert.match(tutorial.illustration, /^\.\/training\/[a-z-]+\.svg$/);
      const svg = await fs.readFile(new URL('../public/' + tutorial.illustration.slice(2), import.meta.url), 'utf8');
      assert.match(svg, /^<svg\s/);
      assert.doesNotMatch(svg, /<script\b|<image\b|\bonload\s*=|\bhref\s*=/i);
    }
  }
});

test('unknown exercise or equipment never opens another variant as its tutorial', async () => {
  for (const id of ['__proto__', 'constructor', 'not-an-exercise']) {
    assert.equal(media.getTrainingMedia(id), undefined);
    assert.equal(media.getTrainingTutorial(id), undefined);
    assert.equal(media.getTrainingIllustration(id), './training/strength.svg');
  }
  assert.equal(media.getTrainingTutorial('d1-e1', 'not-a-variant'), undefined);
  await fs.access(new URL('../public/training/strength.svg', import.meta.url));
});
