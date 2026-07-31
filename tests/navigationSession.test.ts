import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginNavigationStart,
  cancelNavigationStart,
  completeNavigationStart,
  createNavigationStartState,
  isNavigationStartCurrent,
} from '../src/hooks/navigationStartSession';

test('stop invalidates an awaiting navigation start token', () => {
  const started = beginNavigationStart(createNavigationStartState());
  assert.ok(started.token);
  assert.equal(isNavigationStartCurrent(started.state, started.token), true);

  const stopped = cancelNavigationStart(started.state);
  assert.equal(isNavigationStartCurrent(stopped, started.token), false);
  assert.equal(stopped.activeToken, null);
});

test('a stale continuation cannot complete or replace a newer start session', () => {
  const first = beginNavigationStart(createNavigationStartState());
  const stopped = cancelNavigationStart(first.state);
  const second = beginNavigationStart(stopped);
  assert.ok(first.token);
  assert.ok(second.token);

  const staleCompletion = completeNavigationStart(second.state, first.token);
  assert.equal(isNavigationStartCurrent(staleCompletion, second.token), true);
  assert.equal(staleCompletion.activeToken, second.token);
});
