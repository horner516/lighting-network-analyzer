import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveDevice } from '../lib/device-layout.ts';
test('drag and arrow moves preserve every IP exactly once without changing the original draft', () => {
  const order = ['10.0.26.104', '10.0.26.105', '10.0.26.108'];
  assert.deepEqual(moveDevice(order, order[0], order[2]), [order[1], order[2], order[0]]);
  assert.deepEqual(moveDevice(order, order[2], order[0]), [order[2], order[0], order[1]]);
  assert.deepEqual(moveDevice(order, order[1], order[0]), [order[1], order[0], order[2]]);
  assert.equal(moveDevice(order, 'unknown', order[0]), order);
  assert.equal(moveDevice(order, order[0], order[0]), order);
  assert.deepEqual(order, ['10.0.26.104', '10.0.26.105', '10.0.26.108']);
});
