export const PACKET_SIZE = 104;

export const SERVICE_UUID = '679425c8-d3b4-4491-9eb2-3e3d15b625f0';
export const STATUS_UUID = '66fda100-8972-4ec7-971c-3fd30b3072ac';
export const REST_UUID = 'f573f13f-b38e-415e-b8f0-59a6a19a4e02';
export const VALVE_UUID = 'e225a15a-e816-4e9d-99b7-c384f91f273b';

export const COMMAND = {
  STATUS_REPORT: 1,
  COMPRESSOR_STATUS: 24,
  SAVE_CURRENT: 17,
  PRESET_REPORT: 18,
};

export const WHEEL_VALVES = {
  frontRight: { inflate: 0, deflate: 1 },
  rearRight: { inflate: 2, deflate: 3 },
  frontLeft: { inflate: 4, deflate: 5 },
  rearLeft: { inflate: 6, deflate: 7 },
};

function createPacket(command) {
  const buffer = new ArrayBuffer(PACKET_SIZE);
  new DataView(buffer).setUint16(0, command, true);
  return buffer;
}

function packetCommand(buffer) {
  return new DataView(buffer).getUint16(0, true);
}

export function encodeValveMask(mask) {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setUint32(0, mask, true);
  return buffer;
}

export function encodeCompressorStatus(on) {
  const buffer = createPacket(COMMAND.COMPRESSOR_STATUS);
  new DataView(buffer).setUint32(4, on ? 1 : 0, true);
  return buffer;
}

export function encodeSaveCurrentPressures(index) {
  const buffer = createPacket(COMMAND.SAVE_CURRENT);
  new DataView(buffer).setUint32(4, index, true);
  return buffer;
}

export function encodePresetRead(index) {
  const buffer = createPacket(COMMAND.PRESET_REPORT);
  new DataView(buffer).setUint16(12, index, true);
  return buffer;
}

export function decodeStatusReport(buffer) {
  if (buffer.byteLength !== PACKET_SIZE || packetCommand(buffer) !== COMMAND.STATUS_REPORT) {
    return null;
  }

  const view = new DataView(buffer);
  return {
    frontLeft: view.getUint16(8, true),
    frontRight: view.getUint16(4, true),
    rearLeft: view.getUint16(10, true),
    rearRight: view.getUint16(6, true),
    tank: view.getUint16(12, true),
    compressorOn: view.getUint32(16, true) & (1 << 1) ? true : false,
  };
}

export function decodePresetReport(buffer) {
  if (buffer.byteLength !== PACKET_SIZE || packetCommand(buffer) !== COMMAND.PRESET_REPORT) {
    return null;
  }

  const view = new DataView(buffer);
  return {
    index: view.getUint16(12, true),
    frontRight: view.getUint16(4, true),
    rearRight: view.getUint16(6, true),
    frontLeft: view.getUint16(8, true),
    rearLeft: view.getUint16(10, true),
  };
}
