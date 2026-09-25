import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { withDeadline, RequestTimeoutError } from '../src/lib/requestDeadline';

test('returns completed results and propagates service errors', async () => {
  assert.equal(await withDeadline(Promise.resolve('route'), 100), 'route');
  await assert.rejects(withDeadline(Promise.reject(new Error('service')), 100), /service/);
});
test('releases a request that never resolves', async () => {
  await assert.rejects(withDeadline(new Promise(() => {}), 10), RequestTimeoutError);
});
