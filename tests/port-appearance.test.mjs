import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portAppearance } from '../lib/port-appearance.ts';
const port = { direction: 'OUT', active: null, error: null, inputProtocol: null, outputProtocol: 'sACN' };
test('port colors match the approved protocol palette without claiming output from configuration', () => {
  assert.equal(portAppearance(port).text, '#41ec3c');
  assert.equal(portAppearance({ ...port, outputProtocol: 'Art-Net' }).text, '#8bc6ff');
  assert.equal(portAppearance(port).liveOutput, false);
  assert.equal(portAppearance({ ...port, active: true }).liveOutput, true);
  assert.equal(portAppearance({ ...port, active: true, direction: 'IN' }).liveOutput, false);
  assert.equal(portAppearance({ ...port, error: 'Invalid universe', active: true }).liveOutput, false);
  assert.equal(portAppearance({ ...port, error: 'Invalid universe' }).text, '#ff7068');
  assert.equal(portAppearance({ ...port, direction: 'Unknown' }).text, '#84948b');
});
