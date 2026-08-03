'use strict';

const { Device } = require('homey');
const { parseByModel } = require('../../lib/ble-parser');

// Polling interval for BLE advertisements (30 seconds)
const POLL_INTERVAL_MS = 30000;

class GoveeBLESensorDevice extends Device {

  async onInit() {
    this.log('Govee BLE Sensor device initialized');

    this._address = this.getStoreValue('address');
    this._model = this.getStoreValue('model') || this.getData().model;
    this._uuid = this.getData().id;

    this.log(`Device: ${this._model} (${this._address})`);

    // Start polling for BLE advertisements
    this._startPolling();
  }

  /**
   * Start periodic BLE scanning to receive sensor data
   */
  _startPolling() {
    // Initial scan
    this._pollBleData();

    // Set up interval
    this._pollInterval = this.homey.setInterval(() => {
      this._pollBleData();
    }, POLL_INTERVAL_MS);
  }

  /**
   * Scan for BLE advertisements and update sensor values
   */
  async _pollBleData() {
    try {
      const advertisements = await this.homey.ble.discover();

      for (const advertisement of advertisements) {
        if (advertisement.uuid === this._uuid || advertisement.address === this._address) {
          this._processAdvertisement(advertisement);
          return;
        }
      }

      this.log('Device not found in BLE scan');

    } catch (error) {
      this.error('BLE scan error:', error.message);
    }
  }

  /**
   * Process a BLE advertisement and extract sensor data
   * @param {BleAdvertisement} advertisement
   */
  _processAdvertisement(advertisement) {
    // Collect all available data sources
    const serviceData = advertisement.serviceData;
    const manufacturerData = advertisement.manufacturerData;

    if (!serviceData && !manufacturerData) {
      this.log('No service data or manufacturer data in advertisement');
      return;
    }

    // Build array of buffers to try parsing
    const buffers = [];
    if (serviceData) {
      for (const value of Object.values(serviceData)) {
        if (Buffer.isBuffer(value)) {
          buffers.push(value);
        }
      }
    }
    if (manufacturerData && Buffer.isBuffer(manufacturerData)) {
      buffers.push(manufacturerData);
    }

    // Try to parse based on model
    let parsed = null;
    for (const data of buffers) {
      parsed = this._parseByModel(data);
      if (parsed) break;
    }

    if (parsed) {
      this._updateCapabilities(parsed);
    } else {
      this.log(`Could not parse data for model ${this._model}`);
    }
  }

  /**
   * Parse data based on device model. Delegates to lib/ble-parser.js so the
   * same code paths are used by the settings-page BLE diagnostic scan.
   * @param {Buffer} data
   * @returns {Object|null}
   */
  _parseByModel(data) {
    const model = this._model;
    this.log(`Parsing ${data.length} bytes for model ${model}: ${data.toString('hex')}`);

    const result = parseByModel(model, data);
    if (result) {
      const parts = [`${result.temperature}°C`];
      if (result.humidity !== undefined) parts.push(`${result.humidity}%`);
      if (result.battery !== undefined) parts.push(`battery ${result.battery}%`);
      this.log(`Parsed ${model}: ${parts.join(', ')}`);
    }
    return result;
  }

  /**
   * Update Homey capabilities with parsed sensor data
   * @param {Object} data
   */
  async _updateCapabilities(data) {
    try {
      if (data.temperature !== undefined) {
        await this.setCapabilityValue('measure_temperature', data.temperature);
      }

      if (data.humidity !== undefined && this.hasCapability('measure_humidity')) {
        await this.setCapabilityValue('measure_humidity', data.humidity);
      }

      if (data.battery !== undefined) {
        await this.setCapabilityValue('measure_battery', data.battery);
      }
    } catch (error) {
      this.error('Error updating capabilities:', error.message);
    }
  }

  /**
   * Called when the device is deleted
   */
  async onDeleted() {
    this.log('Govee BLE Sensor device deleted');

    if (this._pollInterval) {
      this.homey.clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  async onSettings({ changedKeys }) {
    this.log('Settings changed:', changedKeys);
  }
}

module.exports = GoveeBLESensorDevice;
