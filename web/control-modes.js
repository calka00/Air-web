import { WHEEL_VALVES } from './protocol.js';

const MODES = ['individual', 'axles', 'wholeCar'];

export function valveMask(mode, wheel, action) {
  const wheels = Object.keys(WHEEL_VALVES).filter((candidate) =>
    mode === 'wholeCar' || candidate === wheel ||
    (mode === 'axles' && candidate.startsWith(wheel.startsWith('front') ? 'front' : 'rear')));
  return wheels.reduce((mask, candidate) => mask | (1 << WHEEL_VALVES[candidate][action]), 0);
}

// Keep stop packets behind in-flight writes; discard queued work from old holds/sessions.
export class ValveControl {
  constructor(writeMask) {
    this.writeMask = writeMask;
    this.mode = 'individual';
    this.epoch = 0;
    this.pending = Promise.resolve();
  }

  enqueue(mask) {
    const epoch = this.epoch;
    const operation = this.pending.then(() => {
      if (epoch === this.epoch) return this.writeMask(mask);
    });
    this.pending = operation.catch(() => {});
    return operation;
  }

  start(wheel, action) {
    return this.enqueue(valveMask(this.mode, wheel, action));
  }

  stop() {
    this.epoch += 1;
    return this.enqueue(0);
  }

  cycleMode() {
    const stopped = this.stop();
    this.mode = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length];
    return stopped;
  }

  reset() {
    this.epoch += 1;
  }
}
