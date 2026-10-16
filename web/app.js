import { BleClient, isWebBluetoothAvailable } from './ble-client.js';
import { decodePresetReport, decodeStatusReport, encodeCompressorStatus, encodePresetRead, encodeSaveCurrentPressures, encodeValveMask } from './protocol.js';
import { ValveControl, valveMask } from './control-modes.js';

const client = new BleClient();
const connectButton = document.querySelector('#connect-button');
const status = document.querySelector('#connection-status');
const save = document.querySelector('#save-preset');
const compressorButton = document.querySelector('#compressor-button');
const compressorStatus = document.querySelector('#compressor-status');
let connected = false;
let selectedPreset = null;
let compressorOn = false;
const modeButton = document.querySelector('#control-mode');
const wheelControls = document.querySelector('#wheel-controls');
const valveControl = new ValveControl((mask) => client.writeValve(encodeValveMask(mask)));
let activeHold = null;
const modeLabels = { individual: 'OSOBNO', axles: 'OSIE', wholeCar: 'AUTO' };
const nextModeLabels = { individual: 'OSIE', axles: 'AUTO', wholeCar: 'OSOBNO' };
const modeHints = {
  individual: 'Przytrzymaj + / −, aby sterować wybranym kołem.',
  axles: 'Przytrzymaj + / − przy dowolnym kole, aby sterować całą jego osią.',
  wholeCar: 'Przytrzymaj dowolny + / −, aby sterować całym autem.',
};

const show = (message) => { status.textContent = message; };
const setEnabled = (enabled) => {
  document.querySelectorAll('[data-wheel],[data-preset]').forEach((button) => { button.disabled = !enabled; });
  save.disabled = !enabled || selectedPreset === null;
  compressorButton.disabled = !enabled;
  modeButton.disabled = !enabled;
};
const clearHold = () => {
  const hold = activeHold;
  activeHold = null;
  wheelControls.querySelectorAll('.operating').forEach((card) => card.classList.remove('operating'));
  if (hold?.button.hasPointerCapture(hold.pointerId)) hold.button.releasePointerCapture(hold.pointerId);
};
const releaseValves = () => {
  clearHold();
  if (connected) return valveControl.stop().catch((error) => show(error.message));
  valveControl.reset();
};

for (const axle of ['front', 'rear']) {
  const row = document.createElement('div');
  row.className = 'axle';
  row.dataset.axle = axle;
  wheelControls.append(row);
}

for (const [wheel, label] of Object.entries({ frontRight: 'Prawy przód', frontLeft: 'Lewy przód', rearRight: 'Prawy tył', rearLeft: 'Lewy tył' })) {
  const card = document.createElement('article');
  card.className = 'wheel';
  card.dataset.wheelCard = wheel;
  card.innerHTML = `<h3>${label}</h3><div><button class="inflate" data-wheel="${wheel}" data-action="inflate" aria-label="Dopompuj ${label}" disabled>+</button><button class="deflate" data-wheel="${wheel}" data-action="deflate" aria-label="Spuść ${label}" disabled>-</button></div>`;
  wheelControls.querySelector(`[data-axle="${wheel.startsWith('front') ? 'front' : 'rear'}"]`).append(card);
}

document.querySelectorAll('[data-wheel]').forEach((button) => {
  button.addEventListener('pointerdown', async (event) => {
    if (!connected || activeHold || event.button !== 0) return;
    event.preventDefault();
    activeHold = { button, pointerId: event.pointerId };
    button.setPointerCapture(event.pointerId);
    const mask = valveMask(valveControl.mode, button.dataset.wheel, button.dataset.action);
    wheelControls.querySelectorAll('[data-wheel-card]').forEach((card) => {
      card.classList.toggle('operating', Boolean(mask & valveMask('individual', card.dataset.wheelCard, button.dataset.action)));
    });
    try { await valveControl.start(button.dataset.wheel, button.dataset.action); } catch (error) { show(error.message); }
  });
  ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture'].forEach((type) => button.addEventListener(type, (event) => {
    if (activeHold?.button === button && activeHold.pointerId === event.pointerId) releaseValves();
  }));
});
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseValves(); });
window.addEventListener('pagehide', releaseValves);
window.addEventListener('blur', releaseValves);
modeButton.addEventListener('click', () => {
  if (!connected) return;
  clearHold();
  valveControl.cycleMode().catch((error) => show(error.message));
  const mode = valveControl.mode;
  modeButton.textContent = modeLabels[mode];
  modeButton.setAttribute('aria-label', `Tryb sterowania: ${modeLabels[mode]}. Naciśnij, aby zmienić na ${nextModeLabels[mode]}.`);
  document.querySelector('#control-hint').textContent = modeHints[mode];
  wheelControls.className = `wheel-grid mode-${mode}`;
});

client.onStatus = (buffer) => {
  const pressures = decodeStatusReport(buffer);
  if (!pressures) return;
  Object.entries(pressures).forEach(([key, value]) => { document.querySelector(`[data-pressure="${key}"]`).textContent = value; });
  compressorOn = pressures.compressorOn;
  compressorStatus.textContent = `Stan: ${compressorOn ? 'WŁĄCZONY' : 'WYŁĄCZONY'}`;
  compressorButton.textContent = compressorOn ? 'Wyłącz kompresor' : 'Włącz kompresor';
};
client.onRest = (buffer) => {
  const preset = decodePresetReport(buffer);
  if (preset && preset.index === selectedPreset) document.querySelector('#preset-values').textContent = `FL ${preset.frontLeft} | FR ${preset.frontRight} | RL ${preset.rearLeft} | RR ${preset.rearRight} PSI`;
};
client.onDisconnect = () => { connected = false; clearHold(); valveControl.reset(); setEnabled(false); connectButton.textContent = 'Połącz'; show('Rozłączono.'); };

connectButton.addEventListener('click', async () => {
  if (connected) {
    await releaseValves();
    client.disconnect();
    return;
  }
  if (!isWebBluetoothAvailable(navigator.bluetooth)) { show('Otwórz stronę w Bluefy, aby użyć Bluetooth.'); return; }
  try { show('Wybierz sterownik w oknie Bluetooth.'); await client.connect(); connected = true; setEnabled(true); show('Połączono.'); connectButton.textContent = 'Rozłącz'; }
  catch { connected = false; setEnabled(false); show('Parowanie lub konfiguracja GATT nie powiodły się. Rozłącz drugi klient i spróbuj ponownie.'); }
});
document.querySelectorAll('[data-preset]').forEach((button) => button.addEventListener('click', async () => {
  selectedPreset = Number(button.dataset.preset); document.querySelectorAll('[data-preset]').forEach((item) => item.classList.toggle('active', item === button)); save.disabled = false;
  try { await client.writeRest(encodePresetRead(selectedPreset)); } catch (error) { show(error.message); }
}));
save.addEventListener('click', async () => { try { await client.writeRest(encodeSaveCurrentPressures(selectedPreset)); await client.writeRest(encodePresetRead(selectedPreset)); } catch (error) { show(error.message); } });
compressorButton.addEventListener('click', async () => {
  try {
    await client.writeRest(encodeCompressorStatus(!compressorOn));
    compressorStatus.textContent = 'Stan: oczekiwanie...';
  } catch (error) { show(error.message); }
});
setEnabled(false);
