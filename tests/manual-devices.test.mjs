import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreManualDevices, manualDevice, normalizeIp } from '../lib/manual-devices.ts';

test('new installs and invalid storage start empty', () => {
  for (const value of ['[]', 'null', '{}', 'not json']) assert.deepEqual(restoreManualDevices(value), []);
});

test('legacy manual entries survive without fabricated health or telemetry; samples do not', () => {
  const saved = JSON.stringify([
    { name: 'Old sample', ip: '10.0.0.1', model: 'Sample console', state: 'Healthy' },
    { name: 'My node', ip: '10.0.0.2', model: 'Manually added device', state: 'Warning', traffic: 70, last: 'now' },
    { name: 'Duplicate', ip: '010.000.000.002', source: 'manual' },
    { name: 'Bad IP', ip: '999.0.0.1', source: 'manual' },
  ]);
  assert.deepEqual(restoreManualDevices(saved), [manualDevice('My node', '10.0.0.2')]);
  assert.deepEqual(restoreManualDevices(JSON.stringify(restoreManualDevices(saved))), restoreManualDevices(saved));
});

test('manual entries cannot acquire a measured health state and IPs are normalized', () => {
  assert.equal(normalizeIp(' 010.002.3.004 '), '10.2.3.4');
  assert.equal(normalizeIp('10.2.-1.4'), null);
  assert.deepEqual(manualDevice('', '10.2.3.4'), { name:'Device 10.2.3.4', ip:'10.2.3.4', source:'manual', state:'Unverified' });
});
