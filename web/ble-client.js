import { REST_UUID, SERVICE_UUID, STATUS_UUID, VALVE_UUID } from './protocol.js';

export function isWebBluetoothAvailable(bluetooth) {
  return Boolean(bluetooth?.requestDevice);
}

export class BleClient {
  constructor(bluetooth = navigator.bluetooth) {
    this.bluetooth = bluetooth;
    this.device = null;
    this.rest = null;
    this.status = null;
    this.valve = null;
    this.onStatus = () => {};
    this.onRest = () => {};
    this.onDisconnect = () => {};
  }

  async connect() {
    if (!isWebBluetoothAvailable(this.bluetooth)) {
      throw new Error('Web Bluetooth is unavailable. Open this page in Bluefy.');
    }

    this.device = await this.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
    });
    this.device.addEventListener('gattserverdisconnected', () => this.reset());

    const server = await this.device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    [this.status, this.rest, this.valve] = await Promise.all([
      service.getCharacteristic(STATUS_UUID),
      service.getCharacteristic(REST_UUID),
      service.getCharacteristic(VALVE_UUID),
    ]);

    await this.status.startNotifications();
    await this.rest.startNotifications();
    this.status.addEventListener('characteristicvaluechanged', (event) => {
      this.onStatus(event.target.value.buffer.slice(0));
    });
    this.rest.addEventListener('characteristicvaluechanged', (event) => {
      this.onRest(event.target.value.buffer.slice(0));
    });
  }

  writeRest(buffer) {
    return this.write(this.rest, buffer);
  }

  writeValve(buffer) {
    return this.write(this.valve, buffer);
  }

  write(characteristic, buffer) {
    if (!characteristic) {
      return Promise.reject(new Error('Bluetooth connection is not ready.'));
    }
    if (characteristic.writeValueWithResponse) {
      return characteristic.writeValueWithResponse(buffer);
    }
    return characteristic.writeValue(buffer);
  }

  disconnect() {
    this.device?.gatt?.disconnect();
  }

  reset() {
    this.rest = null;
    this.status = null;
    this.valve = null;
    this.onDisconnect();
  }
}
