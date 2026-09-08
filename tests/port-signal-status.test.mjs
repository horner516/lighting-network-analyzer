import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portSignalPresence } from '../lib/port-signal-status.ts';

const port = { direction:'OUT', active:null, outputAddress:54, displayUniverse:54, outputProtocol:'sACN' };
const snapshot = { available:true, subscribedUniverses:[41,54,55,56], protocols:{sACN:{status:'listening'},'Art-Net':{status:'listening'}}, signals:[] };

test('port presence follows matching live network streams', () => {
  assert.equal(portSignalPresence(port, snapshot), false);
  assert.equal(portSignalPresence(port, { ...snapshot, signals:[{id:'u54',protocol:'sACN',universe:54,ip:'192.168.1.5',priority:100,status:'present',rate:40}] }), true);
  assert.equal(portSignalPresence(port, { ...snapshot, signals:[{id:'old',protocol:'sACN',universe:54,ip:'192.168.1.5',priority:100,status:'timed-out',rate:0}] }), false);
});

test('ProPlex ports N, O, and P show no data when only universes 41 through 53 are present', () => {
  const liveSignals = Array.from({ length:13 }, (_, index) => ({
    id:`u${41 + index}`,
    protocol:'sACN',
    universe:41 + index,
    ip:'192.168.1.5',
    priority:100,
    status:'present',
    rate:40,
  }));
  const liveSnapshot = { ...snapshot, signals:liveSignals };
  const states = Array.from({ length:16 }, (_, index) => portSignalPresence({
    ...port,
    outputAddress:41 + index,
    displayUniverse:41 + index,
  }, liveSnapshot));

  assert.deepEqual(states.slice(0, 13), Array(13).fill(true));
  assert.deepEqual(states.slice(13), [false, false, false]);
});

test('absence remains unknown when Lux Link cannot observe the configured universe', () => {
  assert.equal(portSignalPresence({ ...port, outputAddress:100 }, snapshot), null);
  assert.equal(portSignalPresence(port, { ...snapshot, protocols:{sACN:{status:'error'}} }), null);
  assert.equal(portSignalPresence({ ...port, direction:'IN' }, snapshot), null);
});

test('dual-protocol ports require both listeners before declaring no data', () => {
  const dual = { ...port, outputProtocol:'Art-Net / sACN' };
  assert.equal(portSignalPresence(dual, snapshot), false);
  assert.equal(portSignalPresence(dual, { ...snapshot, protocols:{sACN:{status:'listening'},'Art-Net':{status:'error'}} }), null);
  assert.equal(portSignalPresence(dual, { ...snapshot, protocols:{sACN:{status:'error'},'Art-Net':{status:'listening'}}, signals:[{id:'art',protocol:'Art-Net',universe:54,ip:'192.168.1.5',priority:null,status:'present',rate:40}] }), true);
});
