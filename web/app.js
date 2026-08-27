import { BleClient, isWebBluetoothAvailable } from './ble-client.js';
import { WHEEL_VALVES, decodePresetReport, decodeStatusReport, encodePresetRead, encodeSaveCurrentPressures, encodeValveMask } from './protocol.js';

const client = new BleClient();
const connectButton = document.querySelector('#connect-button');
const status = document.querySelector('#connection-status');
const save = document.querySelector('#save-preset');
let connected = false;
let selectedPreset = null;

const show = (message) => { status.textContent = message; };
const setEnabled = (enabled) => {
  document.querySelectorAll('[data-wheel],[data-preset]').forEach((button) => { button.disabled = !enabled; });
  save.disabled = !enabled || selectedPreset === null;
};
const releaseValves = () => client.writeValve(encodeValveMask(0)).catch((error) => show(error.message));

for (const [wheel, label] of Object.entries({ frontLeft: 'Front Left', frontRight: 'Front Right', rearLeft: 'Rear Left', rearRight: 'Rear Right' })) {
  const card = document.createElement('article');
  card.className = 'wheel';
  card.innerHTML = `<h3>${label}</h3><div><button class="inflate" data-wheel="${wheel}" data-action="inflate" disabled>Inflate</button><button class="deflate" data-wheel="${wheel}" data-action="deflate" disabled>Deflate</button></div>`;
  document.querySelector('#wheel-controls').append(card);
}

document.querySelectorAll('[data-wheel]').forEach((button) => {
  button.addEventListener('pointerdown', async (event) => {
    if (!connected) return;
    button.setPointerCapture(event.pointerId);
    const bit = WHEEL_VALVES[button.dataset.wheel][button.dataset.action];
    try { await client.writeValve(encodeValveMask(1 << bit)); } catch (error) { show(error.message); }
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => button.addEventListener(type, releaseValves));
});
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseValves(); });

client.onStatus = (buffer) => {
  const pressures = decodeStatusReport(buffer);
  if (!pressures) return;
  Object.entries(pressures).forEach(([key, value]) => { document.querySelector(`[data-pressure="${key}"]`).textContent = value; });
};
client.onRest = (buffer) => {
  const preset = decodePresetReport(buffer);
  if (preset && preset.index === selectedPreset) document.querySelector('#preset-values').textContent = `FL ${preset.frontLeft} | FR ${preset.frontRight} | RL ${preset.rearLeft} | RR ${preset.rearRight} PSI`;
};
client.onDisconnect = () => { connected = false; setEnabled(false); connectButton.textContent = 'Connect'; show('Disconnected.'); };

connectButton.addEventListener('click', async () => {
  if (connected) {
    releaseValves();
    client.disconnect();
    return;
  }
  if (!isWebBluetoothAvailable(navigator.bluetooth)) { show('Open this page in Bluefy to use Bluetooth.'); return; }
  try { show('Select your manifold in the Bluetooth picker.'); await client.connect(); connected = true; setEnabled(true); show('Connected.'); connectButton.textContent = 'Disconnect'; }
  catch { connected = false; setEnabled(false); show('Pairing or GATT setup failed. Disconnect the other client and try again.'); }
});
document.querySelectorAll('[data-preset]').forEach((button) => button.addEventListener('click', async () => {
  selectedPreset = Number(button.dataset.preset); document.querySelectorAll('[data-preset]').forEach((item) => item.classList.toggle('active', item === button)); save.disabled = false;
  try { await client.writeRest(encodePresetRead(selectedPreset)); } catch (error) { show(error.message); }
}));
save.addEventListener('click', async () => { try { await client.writeRest(encodeSaveCurrentPressures(selectedPreset)); await client.writeRest(encodePresetRead(selectedPreset)); } catch (error) { show(error.message); } });
setEnabled(false);
