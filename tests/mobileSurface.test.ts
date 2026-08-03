import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSheetResizable,
  presentationForSurface,
  shouldShowPersistentSupport,
  transitionMobileSurface,
} from '../src/lib/mobileSurface';

test('the app opens in explore with a compact sheet', () => {
  assert.equal(presentationForSurface('explore'), 'compact');
});

test('destination action opens planning', () => {
  assert.equal(
    transitionMobileSurface('explore', { type: 'OPEN_PLANNING' }),
    'planning',
  );
});

test('accepted route request enters loading and route success enters results', () => {
  const loading = transitionMobileSurface('planning', { type: 'REQUEST_ROUTES' });
  assert.equal(loading, 'loading');
  assert.equal(transitionMobileSurface(loading, { type: 'ROUTES_READY' }), 'results');
});

test('assistant is secondary and closes back to explore', () => {
  const assistant = transitionMobileSurface('explore', { type: 'OPEN_ASSISTANT' });
  assert.equal(assistant, 'assistant');
  assert.equal(transitionMobileSurface(assistant, { type: 'CLOSE' }), 'explore');
});

test('starting navigation always forces the compact navigation surface', () => {
  assert.equal(
    transitionMobileSurface('results', { type: 'START_NAVIGATION' }),
    'navigation',
  );
  assert.equal(presentationForSurface('navigation'), 'compact');
});

test('route failure returns to planning without discarding endpoints', () => {
  assert.equal(
    transitionMobileSurface('loading', { type: 'ROUTES_FAILED' }),
    'planning',
  );
});

test('closing results returns to explore and keeps route availability external', () => {
  assert.equal(
    transitionMobileSurface('results', { type: 'CLOSE' }),
    'explore',
  );
});

test('ending navigation returns to explore', () => {
  assert.equal(
    transitionMobileSurface('navigation', { type: 'END_NAVIGATION' }),
    'explore',
  );
});

test('fixed result and navigation surfaces do not advertise unsupported resizing', () => {
  assert.equal(isSheetResizable('results'), false);
  assert.equal(isSheetResizable('navigation'), false);
  assert.equal(isSheetResizable('planning'), true);
});

test('persistent desktop support stays out of the active navigation viewport', () => {
  assert.equal(shouldShowPersistentSupport('navigation'), false);
  assert.equal(shouldShowPersistentSupport('explore'), true);
});
