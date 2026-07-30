// Guards the mobile-navigation failure modes fixed in useNavigation.
// This project uses dependency-free Node tests, so this test checks the hook's
// source-level contracts that cannot be mounted without a React test runtime.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/hooks/useNavigation.ts', import.meta.url), 'utf8');

assert.match(source, /const hasFirstFix = await new Promise<boolean>/,
  'navigation must distinguish a valid initial GPS fix from a failed request');
assert.match(source, /if \(!hasFirstFix\)[\s\S]{0,140}setState\('idle'\)/,
  'navigation must return to idle when the initial GPS fix fails');
assert.match(source, /if \(!hasFirstFix\)[\s\S]{0,180}return;/,
  'navigation must not build legs after a failed initial GPS fix');
assert.match(source, /recalcInFlightRef\.current \|\| now - lastRecalcRef\.current/,
  'off-route recalculation must not run concurrently');
assert.match(source, /void recalc\(p\)/,
  'recalculation must use the GPS fix that triggered it');
assert.match(source, /setState\('arrived'\);\s*say\('Has llegado a tu destino\.'\);(?!\s*stopRef\.current)/,
  'arrival must remain visible instead of immediately resetting the session');
assert.match(source, /navigator\.geolocation\?\.clearWatch\?\.\(watchIdRef\.current\)/,
  'stopping navigation must immediately release the GPS watcher');

console.log('ALL TESTS PASS (7/7)');
