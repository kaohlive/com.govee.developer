'use strict';

const { Device } = require('homey');
const tinycolor = require('tinycolor2');
const {
  SERVICE_UUID,
  CONTROL_CHARACTERISTIC_UUID,
  buildPowerCommand,
  buildBrightnessCommand,
  buildColorCommand,
} = require('../../lib/govee-ble-light-protocol');

// Segmented Govee models (this driver currently only targets the H617A) are
// known to drop single writes silently. The community's own H617A bugfix
// sends every command 3x with a short delay to work around it, so we do the
// same instead of trusting a single write.
const WRITE_REPEATS = 3;
const WRITE_REPEAT_DELAY_MS = 150;

// A freshly-opened GATT connection sometimes isn't ready to accept a write
// immediately; give it a moment to settle.
const CONNECT_SETTLE_MS = 200;

// BLE connect attempts occasionally time out even when the light is in
// range (interference, the light being briefly busy, etc). Retry a few
// times before giving up, matching what every other Govee BLE integration
// we've looked at does.
const CONNECT_RETRIES = 3;
const CONNECT_RETRY_DELAY_MS = 500;

// Keep the connection open for a bit after the last command so back-to-back
// changes (e.g. turning on then immediately setting a color) don't each pay
// the full ~5-10s BLE connect cost. Homey itself no longer force-disconnects
// idle peripherals (pre-v6 it did, after 60s), so this is purely us being a
// good citizen and freeing the radio for other BLE activity (e.g. this app's
// own BLE sensor polling) rather than working around a platform timeout. If
// the cached connection turns out to be dead anyway, the 'disconnect' event
// in _getService() or a failed write in _writeFrame() will catch it.
const IDLE_DISCONNECT_MS = 5000;

// After this many consecutive command failures, tell Homey the device is
// unreachable instead of silently leaving the UI out of sync with reality
// (capability changes resolve immediately, before we know if the BLE write
// actually landed - see _sendCommand()).
const UNAVAILABLE_AFTER_FAILURES = 3;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class GoveeBLELightDevice extends Device {

  async onInit() {
    this.log('Govee BLE Light device initialized');

    this._uuid = this.getData().id;
    this._model = this.getStoreValue('model') || 'H617A';

    this._peripheral = null;
    this._service = null;
    this._idleTimer = null;
    this._consecutiveFailures = 0;

    // Serializes all BLE operations so overlapping capability changes don't
    // race each other trying to connect/write/disconnect at the same time.
    this._queue = Promise.resolve();

    // Per-kind version counters used to coalesce rapid bursts of changes
    // (e.g. dragging the brightness slider or color wheel) - see
    // _sendCommand().
    this._commandVersion = { power: 0, brightness: 0, color: 0 };

    this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));
    this.registerCapabilityListener('dim', this.onCapabilityDim.bind(this));
    this.registerMultipleCapabilityListener(
      ['light_hue', 'light_saturation'],
      this.onCapabilityHueSaturation.bind(this)
    );

    this.log(`Device: ${this._model} (${this.getStoreValue('address')})`);
  }

  async onCapabilityOnoff(value) {
    this._sendCommand('power', () => buildPowerCommand(value));
  }

  async onCapabilityDim(value) {
    this._sendCommand('brightness', () => buildBrightnessCommand(value * 255, this._model));
  }

  async onCapabilityHueSaturation(values) {
    const hue = values.light_hue !== undefined ? values.light_hue : this.getCapabilityValue('light_hue');
    const saturation = values.light_saturation !== undefined
      ? values.light_saturation
      : this.getCapabilityValue('light_saturation');

    this._sendCommand('color', () => {
      const rgb = tinycolor({ h: hue * 360, s: saturation * 100, v: 100 }).toRgb();
      return buildColorCommand(rgb.r, rgb.g, rgb.b, this._model);
    });
  }

  /**
   * Queue a command frame, reusing an open connection when possible.
   * Everything runs through a single queue so a second capability change
   * can't jump in mid-connection.
   *
   * Commands are tagged with a `kind` ('power' / 'brightness' / 'color') and
   * coalesced: if a newer command of the same kind gets queued before this
   * one runs (e.g. a slider firing a burst of intermediate values), this one
   * is skipped as a no-op instead of making the strip visibly step through
   * every superseded value.
   *
   * Deliberately not awaited by the capability handlers above: a BLE
   * connect+retry+write cycle can take well past Homey's UI/flow timeout for
   * a capability change, even when it's about to succeed. So we let Homey
   * mark the change as done immediately and let the radio catch up in the
   * background, same as the reference BLE-light Homey app this is modeled
   * on.
   * @param {'power'|'brightness'|'color'} kind
   * @param {() => Buffer} buildFrame Builds the frame lazily, using
   *   whatever capability values are current when the command actually runs.
   */
  _sendCommand(kind, buildFrame) {
    const version = ++this._commandVersion[kind];
    this._queue = this._queue.then(async () => {
      if (this._commandVersion[kind] !== version) return; // superseded

      try {
        await this._writeFrame(buildFrame());
        this._consecutiveFailures = 0;
        await this.setAvailable().catch((err) => this.error('setAvailable failed:', err.message));
      } catch (err) {
        this.error('BLE command failed:', err.message);
        this._consecutiveFailures++;
        if (this._consecutiveFailures >= UNAVAILABLE_AFTER_FAILURES) {
          await this.setUnavailable('Could not reach the light over Bluetooth')
            .catch((err2) => this.error('setUnavailable failed:', err2.message));
        }
      }
    });
    return this._queue;
  }

  async _writeFrame(frame) {
    this._clearIdleTimer();
    try {
      const service = await this._getService();
      try {
        await this._writeFrameToService(service, frame);
      } catch (err) {
        // The cached connection may have silently died since the last
        // command; drop it and retry once against a fresh connection.
        this.log('Write failed on existing connection, reconnecting:', err.message);
        this._peripheral = null;
        this._service = null;
        const freshService = await this._getService();
        await this._writeFrameToService(freshService, frame);
      }
    } finally {
      // Only worth scheduling if we actually have a connection to close.
      if (this._peripheral) this._scheduleDisconnect();
    }
  }

  async _writeFrameToService(service, frame) {
    for (let i = 0; i < WRITE_REPEATS; i++) {
      await service.write(CONTROL_CHARACTERISTIC_UUID, frame);
      if (i < WRITE_REPEATS - 1) await wait(WRITE_REPEAT_DELAY_MS);
    }
  }

  /**
   * Return the current Govee control service, reusing the open connection
   * if there is one, otherwise (re)connecting with a few retries.
   */
  async _getService() {
    if (this._peripheral && this._peripheral.isConnected && this._service) {
      return this._service;
    }

    let lastError;
    for (let attempt = 1; attempt <= CONNECT_RETRIES; attempt++) {
      try {
        // find() returns the cached advertisement instantly if this
        // peripheral is already known to Homey, only falling back to a full
        // discover() scan the first time we ever see it.
        const advertisement = await this.homey.ble.find(this._uuid);
        this.log(`Connecting to BLE peripheral (attempt ${attempt}/${CONNECT_RETRIES})...`);
        const peripheral = await advertisement.connect();
        await peripheral.discoverAllServicesAndCharacteristics();
        const service = await peripheral.getService(SERVICE_UUID);
        await wait(CONNECT_SETTLE_MS);

        // Homey doesn't always fire this on every disconnect, but when it
        // does, the peripheral is definitively gone - drop the cache right
        // away instead of waiting to discover that via a failed write.
        peripheral.on('disconnect', () => {
          this.log('BLE peripheral reported disconnect');
          if (this._peripheral === peripheral) {
            this._peripheral = null;
            this._service = null;
          }
        });

        this._peripheral = peripheral;
        this._service = service;
        return service;
      } catch (err) {
        lastError = err;
        this.log(`Connect attempt ${attempt} failed: ${err.message}`);
        if (attempt < CONNECT_RETRIES) await wait(CONNECT_RETRY_DELAY_MS);
      }
    }
    throw lastError;
  }

  _clearIdleTimer() {
    if (this._idleTimer) {
      this.homey.clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
  }

  _scheduleDisconnect() {
    this._idleTimer = this.homey.setTimeout(() => {
      this._idleTimer = null;
      this._disconnect().catch((err) => this.error('BLE disconnect failed:', err.message));
    }, IDLE_DISCONNECT_MS);
  }

  async _disconnect() {
    const peripheral = this._peripheral;
    this._peripheral = null;
    this._service = null;
    if (peripheral && peripheral.isConnected) {
      this.log('Disconnecting from BLE peripheral');
      await peripheral.disconnect();
    }
  }

  async onUninit() {
    this._clearIdleTimer();
    await this._disconnect().catch((err) => this.error('BLE disconnect failed:', err.message));
  }

  async onDeleted() {
    this.log('Govee BLE Light device deleted');
    this._clearIdleTimer();
    await this._disconnect().catch((err) => this.error('BLE disconnect failed:', err.message));
  }

}

module.exports = GoveeBLELightDevice;
