// Every text Sanga shows has its Hindi, with the same {placeholders}, and no English is shown
// without going through the translation layer (scripts/i18n-check.mjs says what and where).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../scripts/i18n-check.mjs';

test('translations: complete, consistent, nothing left in English', () => {
  const { problems } = check();
  assert.deepEqual(problems.slice(0, 40), [], `${problems.length} problems — run node scripts/i18n-check.mjs --list`);
});
