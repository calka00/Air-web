import test from 'node:test';
import assert from 'node:assert/strict';
import { valveMask, ValveControl } from '../control-modes.js';

test('all wheel and direction combinations match firmware valve groups', () => {
  const individual = { frontRight: [1, 2], rearRight: [4, 8], frontLeft: [16, 32], rearLeft: [64, 128] };
  for (const [wheel, masks] of Object.entries(individual)) {
    for (const [index, action] of ['inflate', 'deflate'].entries()) {
      assert.equal(valveMask('individual', wheel, action), masks[index]);
      assert.equal(valveMask('axles', wheel, action), wheel.startsWith('front') ? [17, 34][index] : [68, 136][index]);
      assert.equal(valveMask('wholeCar', wheel, action), [85, 170][index]);
    }
  }
});

test('starts separately and cycles through axle and whole-car modes', async () => {
  const writes = [];
  const control = new ValveControl(async (mask) => writes.push(mask));
  assert.equal(control.mode, 'individual');
  await control.cycleMode();
  assert.equal(control.mode, 'axles');
  await control.start('rearLeft', 'inflate');
  await control.cycleMode();
  assert.equal(control.mode, 'wholeCar');
  await control.start('frontRight', 'deflate');
  await control.cycleMode();
  assert.equal(control.mode, 'individual');
  assert.deepEqual(writes, [0, 68, 0, 170, 0]);
});

test('release waits for an in-flight write, then sends zero', async () => {
  const writes = [];
  let finish;
  const control = new ValveControl((mask) => {
    writes.push(mask);
    if (mask) return new Promise((resolve) => { finish = resolve; });
  });
  const start = control.start('frontLeft', 'inflate');
  await Promise.resolve();
  const stop = control.stop();
  assert.deepEqual(writes, [16]);
  finish();
  await Promise.all([start, stop]);
  assert.deepEqual(writes, [16, 0]);
});

test('release cancels starts that have not reached Bluetooth yet', async () => {
  const writes = [];
  const control = new ValveControl(async (mask) => writes.push(mask));
  const start = control.start('frontRight', 'inflate');
  await control.stop();
  await start;
  assert.deepEqual(writes, [0]);
});

test('mode change closes valves before next grouped operation', async () => {
  const writes = [];
  const control = new ValveControl(async (mask) => writes.push(mask));
  const canceled = control.start('rearLeft', 'deflate');
  const change = control.cycleMode();
  const next = control.start('frontRight', 'inflate');
  await Promise.all([canceled, change, next]);
  assert.deepEqual(writes, [0, 17]);
});

test('disconnect invalidates queued operations without writing to another session', async () => {
  const writes = [];
  const control = new ValveControl(async (mask) => writes.push(mask));
  const start = control.start('frontRight', 'inflate');
  const stop = control.stop();
  control.reset();
  await Promise.all([start, stop]);
  assert.deepEqual(writes, []);
  await control.start('rearRight', 'deflate');
  assert.deepEqual(writes, [8]);
});

test('failed writes reject and do not block a subsequent stop', async () => {
  const writes = [];
  const control = new ValveControl(async (mask) => {
    writes.push(mask);
    if (mask) throw new Error('GATT failed');
  });
  await assert.rejects(control.start('frontRight', 'inflate'), /GATT failed/);
  await control.stop();
  assert.deepEqual(writes, [1, 0]);
});
