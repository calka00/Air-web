import assert from 'node:assert/strict';
import test from 'node:test';
import { isWebBluetoothAvailable } from '../ble-client.js';
import {
  COMMAND,
  PACKET_SIZE,
  decodePresetReport,
  decodeStatusReport,
  encodeCompressorStatus,
  encodePresetRead,
  encodeSaveCurrentPressures,
  encodeValveMask,
} from '../protocol.js';

test('requires requestDevice support before connection', () => {
  assert.equal(isWebBluetoothAvailable({ requestDevice() {} }), true);
  assert.equal(isWebBluetoothAvailable(undefined), false);
});

test('encodes 104-byte commands and a little-endian profile index', () => {
  const packet = encodeSaveCurrentPressures(4);

  assert.equal(packet.byteLength, PACKET_SIZE);
  assert.deepEqual([...new Uint8Array(packet).slice(0, 8)], [
    COMMAND.SAVE_CURRENT,
    0,
    0,
    0,
    4,
    0,
    0,
    0,
  ]);
});

test('encodes four-byte little-endian valve masks', () => {
  assert.deepEqual([...new Uint8Array(encodeValveMask((1 << 0) | (1 << 7)))], [
    129,
    0,
    0,
    0,
  ]);
});

test('requests a preset with its index in args16 slot four', () => {
  const bytes = new Uint8Array(encodePresetRead(2));

  assert.deepEqual([...bytes.slice(0, 14)], [
    COMMAND.PRESET_REPORT,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    2,
    0,
  ]);
});

test('decodes manifold status into display wheel order', () => {
  const bytes = new Uint8Array(PACKET_SIZE);
  const view = new DataView(bytes.buffer);
  bytes[0] = COMMAND.STATUS_REPORT;
  view.setUint16(4, 11, true);
  view.setUint16(6, 22, true);
  view.setUint16(8, 33, true);
  view.setUint16(10, 44, true);
  view.setUint16(12, 150, true);

  assert.deepEqual(decodeStatusReport(bytes.buffer), {
    frontLeft: 33,
    frontRight: 11,
    rearLeft: 44,
    rearRight: 22,
    tank: 150,
    compressorOn: false,
  });
});

test('encodes compressor state and decodes compressor status bit', () => {
  const command = new Uint8Array(encodeCompressorStatus(true));
  assert.deepEqual([...command.slice(0, 8)], [
    COMMAND.COMPRESSOR_STATUS, 0, 0, 0, 1, 0, 0, 0,
  ]);

  const bytes = new Uint8Array(PACKET_SIZE);
  const view = new DataView(bytes.buffer);
  bytes[0] = COMMAND.STATUS_REPORT;
  view.setUint32(16, 1 << 1, true);
  assert.equal(decodeStatusReport(bytes.buffer).compressorOn, true);
});

test('decodes preset report in firmware wheel order', () => {
  const bytes = new Uint8Array(PACKET_SIZE);
  const view = new DataView(bytes.buffer);
  bytes[0] = COMMAND.PRESET_REPORT;
  view.setUint16(4, 10, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 30, true);
  view.setUint16(10, 40, true);
  view.setUint16(12, 1, true);

  assert.deepEqual(decodePresetReport(bytes.buffer), {
    index: 1,
    frontRight: 10,
    rearRight: 20,
    frontLeft: 30,
    rearLeft: 40,
  });
});
